/** A key as people see it: its name, else the first 8 characters of its access key id. */
export const keyLabel = (key: {
  name?: string | null;
  id?: string;
  accessKeyId?: string;
}) => key.name || (key.id ?? key.accessKeyId ?? "").substring(0, 8);
