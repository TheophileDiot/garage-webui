import Code from "@/components/ui/code";
import Dialog from "@/components/ui/dialog";
import Button from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { useConnectNode } from "../hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConnectNodeSchema, connectNodeSchema } from "../schema";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plug } from "lucide-react";

const ConnectNodeDialog = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<ConnectNodeSchema>({
    resolver: zodResolver(connectNodeSchema),
    defaultValues: { nodeId: "" },
  });

  const connectNode = useConnectNode({
    onSuccess() {
      form.reset({ nodeId: "" });
      setOpen(false);
      toast.success("Node connected");
      queryClient.invalidateQueries({ queryKey: ["status"] });
    },
    onError(err) {
      setOpen(false);
      toast.error(err?.message || "Unknown error");
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    connectNode.mutate(values.nodeId);
  });

  return (
    <>
      <Button color="primary" icon={Plug} onClick={() => setOpen(true)}>
        Connect node
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Connect node"
        actions={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              form="connect-node-form"
              color="primary"
              loading={connectNode.isPending}
            >
              Connect
            </Button>
          </>
        }
      >
        <p className="muted text-sm">
          Run this command on the target node to read its node id:
        </p>
        <Code className="mt-2">docker exec garage /garage node id</Code>

        <form id="connect-node-form" onSubmit={onSubmit} className="mt-6">
          <InputField
            form={form}
            name="nodeId"
            title="Node id"
            placeholder="<id>@<host>:3901"
            autoComplete="off"
            className="w-full"
          />
        </form>
      </Dialog>
    </>
  );
};

export default ConnectNodeDialog;
