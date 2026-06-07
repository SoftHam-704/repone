// Permite importar arquivos como string crua: import md from '...md?raw'
declare module '*.md?raw' {
  const content: string
  export default content
}
declare module '*?raw' {
  const content: string
  export default content
}
