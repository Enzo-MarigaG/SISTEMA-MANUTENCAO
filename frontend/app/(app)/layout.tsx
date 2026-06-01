'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  LogOut,
  Wrench,
  Menu,
  BarChart2,
  UserCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ordens', label: 'Ordens de Serviço', icon: ClipboardList },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
];

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  pixKey?: string;
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['users-me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pixKey, setPixKey] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setPhone(profile.phone ?? '');
      setPixKey(profile.pixKey ?? '');
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (data: { name: string; phone: string; pixKey: string }) =>
      api.patch('/users/me', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-me'] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({ name, phone, pixKey });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Meu Perfil</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Telefone</label>
              <input
                className={inputClass}
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Chave PIX</label>
              <input
                className={inputClass}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Aparece na OS para facilitar o pagamento do cliente
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-60 bg-sidebar border-r border-sidebar-border
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:translate-x-0 lg:z-auto
        `}
      >
        <div className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Wrench className="size-4" />
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground">
            ARC Soluções
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-0.5">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <UserCircle className="size-4 shrink-0" />
            <div className="text-left min-w-0">
              <p className="truncate leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate leading-tight">
                {user.email}
              </p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <LogOut className="size-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 lg:px-6">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <h2 className="text-sm font-medium text-muted-foreground">
            {navItems.find(
              (n) =>
                pathname === n.href || pathname.startsWith(n.href + '/'),
            )?.label ?? 'Sistema'}
          </h2>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
