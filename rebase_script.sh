#!/bin/bash
# Create rebase todo file
cat > /tmp/rebase_todo << 'EOF'
edit a7b9e1b Railway Build Test
pick da1ea2c fix: remove secrets from ecosystem.config.js.example
EOF

GIT_SEQUENCE_EDITOR="cp /tmp/rebase_todo" git rebase -i a7b9e1b~1

