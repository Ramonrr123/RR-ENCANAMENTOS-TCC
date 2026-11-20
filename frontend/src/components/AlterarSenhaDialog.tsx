import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { IconeAcesso } from '@/components/icones/IconesErp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MIN_LENGTH = 6

export function AlterarSenhaDialog({ open, onOpenChange }: Props) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) {
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmacao('')
      setErro(null)
      setSalvando(false)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!senhaAtual || !novaSenha || !confirmacao) {
      setErro('Preencha todos os campos.')
      return
    }
    if (novaSenha.length < MIN_LENGTH) {
      setErro(`A nova senha deve ter pelo menos ${MIN_LENGTH} caracteres.`)
      return
    }
    if (novaSenha !== confirmacao) {
      setErro('A confirmação não confere com a nova senha.')
      return
    }
    if (novaSenha === senhaAtual) {
      setErro('A nova senha deve ser diferente da senha atual.')
      return
    }

    setSalvando(true)
    const res = await api.changePassword(senhaAtual, novaSenha)
    setSalvando(false)

    if (res.error) {
      setErro(res.error)
      return
    }
    toast.success('Senha alterada com sucesso')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconeAcesso className="h-5 w-5" />
              </span>
              Alterar senha
            </DialogTitle>
            <DialogDescription>Informe a senha atual e escolha uma nova senha.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmar-senha">Repetir nova senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </div>
          </div>

          {erro && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Alterar senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
