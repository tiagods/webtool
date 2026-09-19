import { useEffect, useState } from 'react'

export interface ViaCEPResult {
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

const VIACEP_BASE_URL = 'https://viacep.com.br/ws'

interface UseViaCEPReturn {
  data: ViaCEPResult | null
  status: Status
  error: string | null
}

export function useViaCEP(cep: string): UseViaCEPReturn {
  const [data, setData] = useState<ViaCEPResult | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const digits = cep.replace(/\D/g, '')

    if (digits.length !== 8) {
      setData(null)
      setStatus('idle')
      setError(null)
      return
    }

    const timer = setTimeout(async () => {
      setStatus('loading')
      setError(null)

      try {
        const res = await fetch(`${VIACEP_BASE_URL}/${digits}/json/`)
        const json = await res.json()

        if (json.erro) {
          setStatus('error')
          setError('CEP não encontrado.')
          setData(null)
          return
        }

        setData({
          logradouro: json.logradouro ?? '',
          bairro: json.bairro ?? '',
          localidade: json.localidade ?? '',
          uf: json.uf ?? '',
        })
        setStatus('success')
      } catch {
        setStatus('error')
        setError('Erro ao buscar o CEP. Verifique sua conexão.')
        setData(null)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [cep])

  return { data, status, error }
}
