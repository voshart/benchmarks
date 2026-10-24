const exchangeRates = require('../data/exchange-rates.json');
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const usd = (value) =>
  '$' +
  value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2
  });
const unitLabel = (unit) =>
  ({
    currency_per_audio_hour: '/audio hour',
    currency_per_1000_pages: '/1,000 pages',
    currency_per_page: '/page',
    currency_per_month: '/month'
  })[unit] || '';

function conversion(currency, rates = exchangeRates) {
  if (
    !finite(rates.rates?.USD) ||
    rates.rates.USD === 0 ||
    !finite(rates.rates?.[currency]) ||
    rates.rates[currency] === 0
  ) {
    throw new Error('No verified USD exchange rate for ' + currency);
  }
  return {
    rate: rates.rates.USD / rates.rates[currency],
    as_of: rates.as_of,
    source_id: rates.source_id,
    source_url: rates.source_url,
    source_label: rates.source_label
  };
}

function conversionNote(record) {
  if (!record.fx) return '';
  return `Original tariff: ${record.original_currency} ${record.original_amount}${unitLabel(record.unit)}. Converted at 1 ${record.original_currency} = USD ${Number(record.fx.rate.toPrecision(12))}, ${record.fx.source_label}, ${record.fx.as_of}. Approximate USD reference value; payment-provider rates and fees may differ. The tariff date remains ${record.as_of || record.verified_on || 'as recorded'}; this is not a historical exchange-rate reconstruction.`;
}

function normalizeTariff(record, rates = exchangeRates) {
  if (record.currency === 'USD') return record;
  if (!finite(record.amount)) throw new Error('Invalid source-currency price amount');
  const fx = conversion(record.currency, rates);
  const result = {
    ...record,
    currency: 'USD',
    amount: record.amount * fx.rate,
    original_currency: record.currency,
    original_amount: record.amount,
    published_currency: record.published_currency || record.currency,
    approximate: true,
    fx
  };
  result.note = [record.note, conversionNote(result)].filter(Boolean).join(' ');
  return result;
}

function normalizePriceContext(context, rates = exchangeRates) {
  if (!context) return context;
  let result = context;
  const amount = context.amount ?? context.amount_per_1000_pages;
  if (context.currency && finite(amount)) {
    result = normalizeTariff(
      { ...context, amount, unit: context.unit || 'currency_per_1000_pages' },
      rates
    );
    if (context.amount_per_1000_pages != null)
      result = {
        ...result,
        amount_per_1000_pages: result.amount,
        original_amount_per_1000_pages: result.original_amount ?? context.amount_per_1000_pages
      };
    result = { ...result, label: (result.approximate ? '≈' : '') + usd(result.amount) + '†' };
  }
  if (context.prices?.length) {
    const prices = context.prices.map((price) => normalizeTariff(price, rates));
    const summary = prices
      .map((price) => `${price.label}: ${price.approximate ? '≈' : ''}${usd(price.amount)}`)
      .join('; ');
    const originals = prices
      .filter((price) => price.fx)
      .map((price) => `${price.label}: ${price.original_currency} ${price.original_amount}`)
      .join('; ');
    const fx = prices.find((price) => price.fx)?.fx;
    const note = [
      context.note,
      'USD context: ' + summary + '.',
      originals && 'Original tariffs: ' + originals + '.',
      fx &&
        `Converted at 1 ${prices.find((price) => price.fx).original_currency} = USD ${Number(fx.rate.toPrecision(12))}, ${fx.source_label}, ${fx.as_of}. Approximate reference conversions; payment-provider rates and fees may differ.`
    ]
      .filter(Boolean)
      .join(' ');
    result = { ...result, prices, note, ...(fx ? { fx } : {}) };
  }
  return result;
}

module.exports = {
  exchangeRates,
  conversion,
  conversionNote,
  normalizeTariff,
  normalizePriceContext
};
