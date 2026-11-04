//

export type Key = {
  id: string;
  name: string;
  /** Garage 2.x ListKeys carries it; absent on older servers, then the column is not drawn. */
  created?: string | null;
};
