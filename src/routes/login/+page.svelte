<script lang="ts">
  import { authClient } from '$lib/auth/client'

  let { data } = $props()

  const errorMessages: Record<string, string> = {
    'nao-autorizado': 'Seu email não está cadastrado no sistema. Solicite acesso ao coordenador.',
  }

  const errorMsg = $derived(
    data.erro ? (errorMessages[data.erro] ?? 'Erro ao fazer login.') : null
  )

  async function loginWithGoogle() {
    if (data.provider === 'neon') {
      // Better Auth — inicia fluxo OAuth via POST /auth/sign-in/social
      await authClient.signIn.social({ provider: 'google', callbackURL: '/fila' })
    } else {
      // Auth.js — redireciona para /auth/signin/google
      window.location.href = '/auth/signin/google'
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-50">
  <div class="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <!-- Cabeçalho -->
    <div class="space-y-1 text-center">
      <h1 class="text-xl font-semibold text-slate-900">Agenda Prótese Digital</h1>
      <p class="text-sm text-slate-500">Secretaria de Saúde — Atibaia/SP</p>
    </div>

    <!-- Mensagem de erro -->
    {#if errorMsg}
      <div class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {errorMsg}
      </div>
    {/if}

    <!-- Botão de login -->
    <button
      onclick={loginWithGoogle}
      class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      {@render GoogleIcon()}
      Entrar com Google
    </button>

    <p class="text-center text-xs text-slate-400">
      Acesso restrito a servidores cadastrados
    </p>
  </div>
</div>

{#snippet GoogleIcon()}
  <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
{/snippet}
