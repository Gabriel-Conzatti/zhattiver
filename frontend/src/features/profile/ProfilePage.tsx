import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, UserRound } from 'lucide-react';

import { useAuth } from '@/app/AuthProvider';
import { profile } from '@/lib/api';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  sdr: 'SDR',
  sinistros: 'Sinistros',
};

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<string | null>(null);

  useEffect(() => setName(user?.name ?? ''), [user?.name]);

  const updateProfile = useMutation({
    mutationFn: () => profile.update(name),
    onSuccess: async () => {
      await refresh();
      setProfileFeedback('Perfil atualizado com sucesso.');
    },
    onError: (error) => setProfileFeedback((error as Error).message),
  });

  const changePassword = useMutation({
    mutationFn: () => profile.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setPasswordFeedback('Senha alterada. As outras sessões foram encerradas.');
    },
    onError: (error) => setPasswordFeedback((error as Error).message),
  });

  function submitPassword() {
    if (newPassword.length < 10) {
      setPasswordFeedback('A nova senha deve ter pelo menos 10 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setPasswordFeedback('A confirmação não corresponde à nova senha.');
      return;
    }
    setPasswordFeedback(null);
    changePassword.mutate();
  }

  if (!user) {
    return <div className="card p-6 text-sm text-text-secondary">Perfil indisponível.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Atualize seus dados pessoais e proteja o acesso à conta.
        </p>
      </header>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserRound className="h-5 w-5 text-brand-cyan" /> Dados pessoais
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <span className="label">Nome</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span className="label">E-mail</span>
            <input className="input opacity-70" value={user.email} readOnly />
          </label>
          <label>
            <span className="label">Perfil de acesso</span>
            <input
              className="input opacity-70"
              value={ROLE_LABELS[user.role] ?? user.role}
              readOnly
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={!name.trim() || name.trim() === user.name || updateProfile.isPending}
            onClick={() => updateProfile.mutate()}
          >
            {updateProfile.isPending ? 'Salvando…' : 'Salvar perfil'}
          </button>
          {profileFeedback && <p className="text-sm text-text-secondary">{profileFeedback}</p>}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <KeyRound className="h-5 w-5 text-brand-cyan" /> Alterar senha
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          A alteração encerra todas as outras sessões abertas. Esta sessão permanece ativa.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label>
            <span className="label">Senha atual</span>
            <input
              type="password"
              autoComplete="current-password"
              className="input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            <span className="label">Nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            <span className="label">Confirmar nova senha</span>
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            disabled={
              !currentPassword || !newPassword || !confirmation || changePassword.isPending
            }
            onClick={submitPassword}
          >
            {changePassword.isPending ? 'Alterando…' : 'Alterar senha'}
          </button>
          {passwordFeedback && <p className="text-sm text-text-secondary">{passwordFeedback}</p>}
        </div>
      </section>
    </div>
  );
}
