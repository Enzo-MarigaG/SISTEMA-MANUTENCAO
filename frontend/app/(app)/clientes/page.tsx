'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Search, Pencil, Trash2, X, Phone, MapPin } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  city?: string;
  active: boolean;
}

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CustomerForm({ defaultValues, onSubmit, onCancel, isSubmitting }: {
  defaultValues?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Nome *</label>
          <input className={inputClass} {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail</label>
          <input type="email" className={inputClass} {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Telefone</label>
          <input className={inputClass} {...register('phone')} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">CPF/CNPJ</label>
          <input className={inputClass} {...register('document')} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Cidade</label>
          <input className={inputClass} {...register('city')} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Endereço</label>
          <input className={inputClass} {...register('address')} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Observações</label>
          <textarea className={`${inputClass} resize-none`} rows={2} {...register('notes')} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : 'Salvar'}</Button>
      </div>
    </form>
  );
}

export default function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get('/customers', { params: search ? { search } : {} }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post('/customers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowCreate(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => api.put(`/customers/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setEditing(null); },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} cadastrado{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo Cliente</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <input
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
          <p className="text-sm">{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden space-y-2">
            {customers.map((c) => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{c.name}</p>
                    {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {c.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="size-3" />{c.phone}
                        </span>
                      )}
                      {c.city && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />{c.city}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(c)}
                      className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Desativar "${c.name}"?`)) removeMutation.mutate(c.id); }}
                      className="p-2 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground">Telefone</th>
                    <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden md:table-cell">Cidade</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{c.name}</p>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{c.phone || '—'}</td>
                      <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{c.city || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditing(c)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Desativar cliente "${c.name}"?`)) removeMutation.mutate(c.id); }}
                            className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <Modal title="Novo Cliente" onClose={() => setShowCreate(false)}>
          <CustomerForm onSubmit={(data) => createMutation.mutate(data)} onCancel={() => setShowCreate(false)} isSubmitting={createMutation.isPending} />
        </Modal>
      )}

      {editing && (
        <Modal title="Editar Cliente" onClose={() => setEditing(null)}>
          <CustomerForm
            defaultValues={editing}
            onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })}
            onCancel={() => setEditing(null)}
            isSubmitting={updateMutation.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
