import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import WavesBackground from '@/components/WavesBackground'
import { HiEye, HiEyeOff } from 'react-icons/hi'
import { api } from '@/services/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  function entrarSemServidor(identificador: string) {
    const nome = identificador || 'Administrador'
    const empresa = { id: 1, codigo: '01', nome: 'Matriz' }
    localStorage.setItem('access_token', 'preview-local')
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        nome,
        email: identificador || 'admin@rr.local',
        login: identificador || 'admin',
        isAdmin: true,
        grupoUsuario: { id: 'admin', name: 'administradores', label: 'Administradores' },
        companies: [empresa],
      }),
    )
    localStorage.setItem('selectedCompany', JSON.stringify(empresa))
    setSuccess(true)
    window.setTimeout(() => {
      navigate('/')
      window.location.reload()
    }, 300)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const identificador = email.trim()
    const response = await api.login(identificador, password)
    if (response.data?.access_token) {
      setSuccess(true)
      window.setTimeout(() => {
        navigate('/')
        window.location.reload()
      }, 300)
      return
    }
    if (!import.meta.env.PROD && !response.status) {
      entrarSemServidor(identificador)
      return
    }
    setLoading(false)
    setError(response.error || 'Não foi possível entrar.')
  }

  return (
    <div className="flex min-h-screen [color-scheme:light]">
      {/* Lado esquerdo - Waves (cores fixas) */}
      <div className="hidden md:block md:w-3/5 lg:w-[60%] min-h-screen">
        <WavesBackground />
      </div>

      {/* Lado direito - Formulário (cores fixas, sem tema) */}
      <div className="w-full md:w-2/5 lg:w-[40%] min-h-screen bg-white flex flex-col items-center justify-between py-8 px-5 sm:py-16 sm:px-8 md:px-16">
        <div className="flex-shrink-0" />

        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          <div className="flex items-center justify-center">
            <img src="/logo-rr-encanamentos.png?v=2" alt="RR Encanamentos" className="h-36 w-auto object-contain sm:h-56" />
          </div>

          <form onSubmit={onSubmit} className="w-full flex flex-col gap-5">
            <div className="relative">
              <Input
                type="text"
                placeholder="Usuário ou E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pr-10 h-12 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
              />
              <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-12 border-gray-200 bg-white text-gray-900 placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <HiEyeOff className="h-5 w-5" /> : <HiEye className="h-5 w-5" />}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm text-center flex items-center justify-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm text-center flex items-center justify-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Login realizado com sucesso! Redirecionando...</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold tracking-widest bg-[#e10600] hover:bg-[#b00012] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || success}
            >
              {loading || success ? 'Entrando…' : 'ENTRAR'}
            </Button>
          </form>
        </div>

        <p className="text-sm text-gray-500">
          © 2026 RR Encanamentos. Todos os direitos reservados.
          {' · '}
          <a href="/privacidade" className="underline hover:text-[#e10600]">Política de privacidade</a>
        </p>
      </div>
    </div>
  )
}
