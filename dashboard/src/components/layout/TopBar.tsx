import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Bell, Sun, Moon, Clock, User, LogOut, Settings } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDashboardStore } from '@/store/dashboard'
import { login } from '@/services/api'

export function TopBar() {
  const [time, setTime] = useState(new Date())
  const { theme, toggleTheme, searchQuery, setSearchQuery, isAuthenticated, setAuthenticated } = useDashboardStore()
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogin = useCallback(async () => {
    try {
      await login(password)
      localStorage.setItem('m_token', password)
      setAuthenticated(true)
      setLoginError(false)
      setPassword('')
    } catch {
      setLoginError(true)
    }
  }, [password, setAuthenticated])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('m_token')
    setAuthenticated(false)
  }, [setAuthenticated])

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card border border-border rounded-2xl p-10 w-[400px] shadow-2xl"
        >
          <div className="flex flex-col items-center gap-6">
            <img src="/mundonet_brand.png" alt="Mundonet" className="h-14" />
            <h2 className="text-xl font-extrabold text-foreground">Acesso Restrito</h2>
            <p className="text-sm text-muted-foreground text-center">
              Digite a senha mestra para acessar o painel
            </p>
            <Input
              type="password"
              placeholder="••••••••"
              className="text-center text-lg tracking-widest"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
            {loginError && (
              <p className="text-sm font-bold text-destructive">Senha incorreta. Tente novamente.</p>
            )}
            <Button className="w-full font-extrabold" size="lg" onClick={handleLogin}>
              ENTRAR NO PAINEL
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <header className="h-16 px-6 flex items-center justify-between gap-4 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="global-search"
            placeholder="Buscar técnico, cliente ou O.S...."
            className="pl-9 pr-16 h-9 text-sm bg-muted/50 border-muted"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border pointer-events-none">
            Ctrl+K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-semibold tabular-nums">
          <Clock className="w-4 h-4" />
          <span>
            {time.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' } as const)} •{' '}
            {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' } as const)}
          </span>
        </div>

        <Button variant="ghost" size="icon" className="relative" onClick={() => {}}>
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarImage src="" alt="Admin" />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                AD
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 right-0">
            <DropdownMenuLabel>Admin</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" /> Perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
