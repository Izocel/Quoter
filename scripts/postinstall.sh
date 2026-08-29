#!/bin/bash
set -e

npm outdated > ci/outdated.md
npm audit > ci/audit.md