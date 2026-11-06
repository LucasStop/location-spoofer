#!/bin/sh
# Roda a cópia instalada por install-bridge.sh (fora de ~/Downloads, que o launchd não lê).
# ponytail: node fixado no nvm v22.23.3; atualizar PATH se trocar de versão.
export PATH=/Users/lucasstopinski/.nvm/versions/node/v22.23.3/bin:/Library/Frameworks/Python.framework/Versions/3.14/bin:/usr/local/bin:/usr/bin:/bin
cd "$(dirname "$0")" || exit 1
set -a; . ./bridge.env; set +a
exec node index.js
