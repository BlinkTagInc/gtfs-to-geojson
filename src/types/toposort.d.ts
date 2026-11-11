declare module 'toposort' {
  export default function toposort<T>(edges: ReadonlyArray<[T, T]>): T[];
}
