# VPS Hostinger

Roteiro canônico: [checklist-producao.md](../../checklist-producao.md).

## Ambiente de produção

- Provedor: Hostinger.
- Endereço confirmado: `179.197.72.43`.
- Aplicação: `/opt/lynk/app`.
- Domínio: `https://funil.zhattiver.com`.

O endereço `212.85.6.112:65002`, testado durante o diagnóstico inicial, não corresponde
ao ambiente ativo deste projeto. Não registrar senhas ou chaves privadas nesta nota.

## Acesso

O acesso é por chave pública, como `root`. A chave usada é a dedicada
`~/.ssh/funil_vps_ed25519`, que precisa ser indicada explicitamente com `-i`, porque não
existe um `~/.ssh/config` associando a chave ao host. Sem o `-i`, o cliente tenta as
chaves padrão e a conexão falha com `Permission denied (publickey,password)`.

```powershell
$key = Join-Path $HOME '.ssh\funil_vps_ed25519'
ssh -i $key root@179.197.72.43 "cd /opt/lynk/app && bash scripts/deploy.sh < /dev/null"
```

O `< /dev/null` é obrigatório: o script usa `docker compose exec -T`, que consome o stdin
herdado da sessão SSH.

## Hardening de acesso e firewall

- SSH efetivo: root permitido somente por chave (`PermitRootLogin prohibit-password`); `PasswordAuthentication` e autenticacao interativa desativadas, `MaxAuthTries 5`. Configuracao em `/etc/ssh/sshd_config.d/00-lynk-hardening.conf`.
- `fail2ban` habilitado com jail `sshd` (5 falhas em 10 minutos, banimento por 1 hora, backend systemd).
- UFW permite SSH, HTTP/HTTPS e UDP/443 para Caddy/HTTP3; removidas as regras de Nginx Full e UDP 7777, 7778 e 27015 sem servicos associados.
- Validado com conexao por chave apos reload, `sshd -T`, `fail2ban-client status sshd` e `ufw status numbered`.
