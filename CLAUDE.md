# Instruções para o Claude — leia antes de mexer neste repositório

**Este repositório não é editado diretamente.** Ele é o espelho público
de `site/` do repositório `AlexandreLeone/tabua-de-mares` (privado), e
existe só porque GitHub Pages em repositório privado exige plano pago —
este aqui é público de propósito, só pra hospedar o Pages de graça em
`paineltabuademares.com.br`.

## Como a publicação funciona
A cada push na `main` do `tabua-de-mares` que toque em `site/`, o
workflow `.github/workflows/sync-site.yml` **daquele** repositório
copia `site/` inteiro pra cá (espelho exato, inclusive apagando aqui o
que não existir lá) e empurra direto pra esta `main`. Esses commits
aparecem com autor `tabua-de-mares-bot` e mensagem
`Publica site/ do tabua-de-mares@<hash>`.

**Qualquer outra coisa que mudar algo aqui diretamente —** edição de
arquivo, PR, merge — **é sobrescrita (ou apagada) no próximo sync.**
Este `CLAUDE.md` é a única exceção (o workflow o ignora de propósito).

## Se o site precisa mudar
Edite em `AlexandreLeone/tabua-de-mares`, dentro da pasta `site/`, e dê
push na `main` de lá. A publicação aqui acontece sozinha, em 1–2
minutos. Não crie branch, não abra PR, não edite nada neste repositório
diretamente — nem para corrigir às pressas, porque a correção some no
próximo sync de qualquer forma.

## Cuidado com Settings → Pages
Editar o campo "Custom domain" pela interface do GitHub (apagar e
redigitar, por exemplo) faz o próprio GitHub commitar "Delete CNAME" e
"Create CNAME" direto na `main`, fora desse fluxo — é esperado e
inofensivo (o sync seguinte restaura o `CNAME` do jeito certo), mas
**enquanto o domínio fica sem `CNAME` o certificado HTTPS cai**, então
evite mexer nesse campo sem necessidade. Se o site parecer fora do ar
depois de mexer nisso, é normal levar alguns minutos pro certificado
ser reemitido.

## Mais contexto do projeto
Pendências, repositórios da família, processo de pagamento etc. estão
no `CLAUDE.md` do `AlexandreLeone/tabua-de-mares` — este repositório
não tem lógica própria de projeto, é só o alvo da publicação.
