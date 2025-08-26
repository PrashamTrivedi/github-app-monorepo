#!/bin/bash
set -e

# Initialize git configuration if not already set
if [ ! -z "$GIT_AUTHOR_NAME" ]; then
    git config --global user.name "$GIT_AUTHOR_NAME"
fi

if [ ! -z "$GIT_AUTHOR_EMAIL" ]; then
    git config --global user.email "$GIT_AUTHOR_EMAIL"
fi

# Set up GitHub authentication if token is provided
if [ ! -z "$GITHUB_TOKEN" ]; then
    # Configure git to use the token for authentication
    git config --global url."https://$GITHUB_TOKEN@github.com/".insteadOf "https://github.com/"
    
    # Set up GitHub CLI authentication
    echo "$GITHUB_TOKEN" | gh auth login --with-token
fi

# Execute the provided command
exec "$@"