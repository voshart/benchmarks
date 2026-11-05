"""Inspect pinned public SVG test splits without executing or scoring a tracer.

Requires pyarrow. Downloads stay outside the repository; only aggregate audit
metadata is published. Conservative paint audit, not a general SVG renderer.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

DATASETS = {
    'svg-icons': '0dfc1bee713256e64d5c16d7427c4c29de823d70',
    'svg-icons-simple': 'e1918a27ba6649e856e5db0710d8a6c7046762c1',
    'FIGR-SVG': 'ead610a5ad3fa5165061105b18d49f6acd84336f',
    'svg-fonts-simple': '453c739ea13ad2685127f721c333f14d99485299',
}
BLACK = {'black', '#000', '#000000', 'rgb(0,0,0)'}
SAFE_TAGS = {'svg', 'path', 'g', 'title', 'desc', 'metadata', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline'}

def inspect(rows):
    tags, paints, findings = Counter(), Counter(), Counter()
    for row in rows:
        svg = row.get('Svg', row.get('svg'))
        try:
            root = ET.fromstring(svg)
        except (ET.ParseError, TypeError):
            findings['parse_error_rows'] += 1
            continue
        row_tags, row_paints = set(), set()
        opacity, uncertain = False, False
        for element in root.iter():
            tag = element.tag.rsplit('}', 1)[-1]
            tags[tag] += 1
            row_tags.add(tag)
            if tag not in SAFE_TAGS or 'class' in element.attrib:
                uncertain = True
            attributes = dict(element.attrib)
            for declaration in attributes.get('style', '').split(';'):
                if ':' in declaration:
                    key, value = declaration.split(':', 1)
                    attributes[key.strip()] = value.strip()
            for key in ('fill', 'stroke'):
                if key in attributes:
                    value = attributes[key].lower().replace(' ', '')
                    paints[value] += 1
                    if value not in {'none', 'transparent'}:
                        row_paints.add(value)
            for key in ('opacity', 'fill-opacity', 'stroke-opacity'):
                try:
                    if float(attributes.get(key, '1')) != 1:
                        opacity = True
                except ValueError:
                    uncertain = True
            if any(key in attributes for key in ('filter', 'mask', 'clip-path')):
                uncertain = True
        if row_tags & {'linearGradient', 'radialGradient'}:
            findings['gradient_rows'] += 1
        if 'image' in row_tags:
            findings['embedded_image_rows'] += 1
        if opacity:
            findings['nonunit_opacity_rows'] += 1
        if not uncertain and not opacity and row_paints <= BLACK:
            findings['opaque_black_only_rows'] += 1
        else:
            findings['colour_or_unresolved_rows'] += 1
    return {
        'rows': len(rows),
        **{key: findings[key] for key in ['opaque_black_only_rows', 'gradient_rows', 'embedded_image_rows', 'nonunit_opacity_rows', 'parse_error_rows', 'colour_or_unresolved_rows']},
        'element_counts': dict(sorted(tags.items())),
        'explicit_paint_counts': dict(sorted(paints.items())),
    }

def main():
    import pyarrow.parquet as pq
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    datasets = []
    for name, revision in DATASETS.items():
        dataset = 'starvector/' + name
        path = 'data/test-00000-of-00001.parquet'
        url = f'https://huggingface.co/datasets/{dataset}/resolve/{revision}/{path}'
        cached = args.cache / (name.lower() + '-test.parquet')
        if not cached.exists():
            urllib.request.urlretrieve(url, cached)
        checksum = hashlib.sha256(cached.read_bytes()).hexdigest()
        # Check downloaded bytes against the pinned Hub LFS object, not a moving main.
        tree_url = f'https://huggingface.co/api/datasets/{dataset}/tree/{revision}?recursive=true'
        tree = json.load(urllib.request.urlopen(tree_url, timeout=30))
        expected = next(file['lfs']['oid'] for file in tree if file['path'] == path)
        if checksum != expected:
            raise ValueError(f'{dataset}: pinned LFS hash mismatch')
        result = {'dataset': dataset, 'revision': revision, 'split': 'test', 'path': path, 'source_url': url, 'bytes': cached.stat().st_size, 'sha256': checksum, **inspect(pq.read_table(cached).to_pylist())}
        result['monotrace_status'] = 'eligible-unmeasured' if result['opaque_black_only_rows'] == result['rows'] else 'requires-subset-or-colour-protocol'
        datasets.append(result)
        print(name, result['rows'], 'black-only', result['opaque_black_only_rows'], 'gradients', result['gradient_rows'], flush=True)
    report = {'schema_version': 1, 'checked_date': '2026-11-05', 'operator': 'Voshart benchmark maintainer', 'method': 'Complete pinned test-parquet XML audit. Counts exact SVG elements, explicit fill/stroke tokens and opacity; opaque-black classification permits only listed simple vector tags with no unresolved CSS, paint servers, filters, masks or references. No image recolouring, tracer execution or quality score is performed.', 'paper_comparability': 'These released file lists differ in size from the paper table. Dataset compatibility does not establish a matched paper-era score or justify filling any missing observation.', 'datasets': datasets}
    args.output.write_text(json.dumps(report, indent=2) + '\n')

if __name__ == '__main__':
    main()
