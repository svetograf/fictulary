type TransformArgs = { value: unknown };

export const trim = ({ value }: TransformArgs) =>
  typeof value === 'string' ? value.trim() : value;
