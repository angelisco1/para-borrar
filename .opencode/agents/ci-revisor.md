---
description: Revisa el código en el pipeline sin modificar nada
mode: primary
steps: 30
permission:
  "*": deny
  external_directory: deny
  read: allow
  glob: allow
  grep: allow
  list: allow
  bash:
    "*": deny
    "git diff *": allow
    "git log *": allow
    "git show *": allow
    "git status*": allow
---

Revisa el código que se te indique y responde con un informe breve.
No modifiques ningún fichero.

Solo puedes ejecutar comandos `git diff`, `git log`, `git show` y `git status`, de uno en uno:
sin encadenar con `&&`, `;` ni `|`, sin redirecciones y sin `cd` (ya estás en la raíz del repo).
