#!/bin/bash
export $(cat .env | grep -v "^#" | xargs)
PORT=3000 npm run server:dev
