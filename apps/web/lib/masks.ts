import type { FactoryOpts } from 'imask'

export const CEP_MASK = '00000-000'

export const CPF_MASK = '000.000.000-00'

export const CNPJ_MASK = '00.000.000/0000-00'

export const PIS_MASK = '000.00000.00-0'

export const PHONE_MASK: FactoryOpts[] = [
  { mask: '(00) 00000-0000' },
  { mask: '(00) 0000-0000' },
]

export const CURRENCY_MASK: FactoryOpts = {
  mask: 'R$ num',
  blocks: {
    num: {
      mask: Number,
      scale: 2,
      thousandsSeparator: '.',
      radix: ',',
      mapToRadix: ['.'],
      min: 0,
    },
  },
}
