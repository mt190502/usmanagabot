{
  lib ? import <nixpkgs/lib>,
  pkgs ? import <nixpkgs> { },
  ...
}:

let
  #~ Project Configuration
  projectName = "usmanagabot";

  #~ Aliases for development shell
  aliases = {
    "build-run" = "bun run start";
    "build-debug" = "bun run --inspect-brk src/main.ts";
    "build-test" = "bun test";
    "build-clean" = "rm -rf dist node_modules .bun";
  };

  #~ Environment Variables
  environmentVars = {
    NODE_ENV = "development";
  };

  #~ Packages
  commonPackages = with pkgs; [
    #~ Typescript
    bun
    nodejs
    pnpm

    #~ Development Tools
    direnv

    #~ Required Libraries
    # libyamlcpp
  ];

  shells = rec {
    default = zsh;
    bash = {
      packages = [ ];
      environments = { };
      hooks = ''
        # Setup temporary bash configuration
        export HISTFILE="$PWD/.bash_history"

        # Generate runtime bashrc
        echo -e 'export PS1="\[\e[32m\]\u@\h:\[\e[34m\]\w\[\e[0m\]$ "
        ' > $PWD/.bashrc
      '';
    };
    zsh = {
      packages = with pkgs; [
        oh-my-zsh
        zsh-completions
        zsh-autosuggestions
        zsh-syntax-highlighting
      ];
      environments = {
        ZSH_THEME = "amuse";
        ZSH_COMPDUMP = "/tmp/.zcompdump";
      };
      hooks = ''
        # Setup temporary zsh configuration
        export ZDOTDIR=$PWD
        export HISTFILE="$PWD/.zsh_history"

        # Generate runtime zshrc
        echo -e 'export ZSH="${pkgs.oh-my-zsh}/share/oh-my-zsh"

        # Completions
        fpath=(${pkgs.zsh-completions}/share/zsh/site-functions $fpath)
        autoload -U compinit && compinit

        # Autosuggestions
        source ${pkgs.zsh-autosuggestions}/share/zsh-autosuggestions/zsh-autosuggestions.zsh

        # Syntax highlighting
        source ${pkgs.zsh-syntax-highlighting}/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

        # Set plugins
        plugins=(git colored-man-pages command-not-found)
        source $ZSH/oh-my-zsh.sh

        # Aliases and Functions
        ${lib.concatStringsSep "\n" (lib.mapAttrsToList (name: cmd: "alias ${name}=\"${cmd}\"") aliases)}
        ' > $ZDOTDIR/.zshrc
        [ -z "$CHROME_DESKTOP" ] || [ -z "$VSCODE_CLI" ] && exec ${pkgs.zsh}/bin/zsh
      '';
    };
  };


  commonHooks = ''
    echo "================================================================="
    echo "🚀 ${projectName} Development Environment (Bun Version: $(bun --version))"
    echo "================================================================="
    if [ ! -f .envrc ]; then
      echo "use flake" > .envrc
      echo "📝 Created .envrc for direnv integration"
      echo "Please run 'direnv allow' to enable it."
      echo "================================================================="
    fi
    echo "To run the project, use 'build-run' alias"
    echo "================================================================="
  '';
in
lib.mapAttrs (
  name: shell:
  pkgs.mkShellNoCC {
    buildInputs = commonPackages ++ shell.packages;
    shellHook = commonHooks + shell.hooks;
    env = shell.environments // environmentVars;
  }
) shells
