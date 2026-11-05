export type Config = {
  metadata_dir: string;
  data_dir: string;
  db_engine: string;
  metadata_auto_snapshot_interval: string;
  replication_factor: number;
  compression_level: number;
  rpc_bind_addr: string;
  rpc_public_addr: string;
  s3_api?: S3API;
  s3_web?: S3Web;
  admin?: Admin;
};

type Admin = {
  api_bind_addr: string;
};

type S3API = {
  s3_region: string;
  api_bind_addr: string;
  root_domain: string;
};

type S3Web = {
  bind_addr: string;
  root_domain: string;
  index: string;
};
