// Every *.ctp.graphql file imports as an Apollo DocumentNode (webpack loader from mc-scripts).
// Result/variable types are written by hand in the hooks, since this project doesn't run GraphQL codegen.
declare module '*.ctp.graphql' {
  import type { DocumentNode } from 'graphql';
  const defaultDocument: DocumentNode;
  export default defaultDocument;
}
