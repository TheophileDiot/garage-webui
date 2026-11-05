import Code from "@/components/ui/code";
import Dialog, { FormActions } from "@/components/ui/dialog";
import Button from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { useConnectNode } from "../hooks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ConnectNodeSchema, connectNodeSchema } from "../schema";
import { useState } from "react";
import { toast } from "sonner";
import { handleError } from "@/lib/utils";
import { Plug } from "lucide-react";

const ConnectNodeDialog = () => {
  const [open, setOpen] = useState(false);

  const form = useForm<ConnectNodeSchema>({
    resolver: zodResolver(connectNodeSchema),
    defaultValues: { nodeId: "" },
  });

  const connectNode = useConnectNode({
    onSuccess() {
      form.reset({ nodeId: "" });
      setOpen(false);
      toast.success("Node connected");
    },
    // The dialog stays open with the error so the id can be fixed and sent again.
    onError: handleError,
  });

  const close = () => {
    setOpen(false);
    connectNode.reset();
  };

  const onSubmit = form.handleSubmit((values) => {
    connectNode.mutate(values.nodeId.trim());
  });

  return (
    <>
      <Button variant="primary" icon={Plug} onClick={() => setOpen(true)}>
        Connect node
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Connect node"
        dismissible={!connectNode.isPending}
        actions={
          <FormActions
            onCancel={close}
            pending={connectNode.isPending}
            formId="connect-node-form"
            submitLabel="Connect"
          />
        }
      >
        <p className="text-ink-2">
          Run this command on the target node to read its node id:
        </p>
        <Code className="mt-2 max-md:[&_button]:min-h-9 max-md:[&_button]:min-w-9">
          docker exec garage /garage node id
        </Code>

        <form id="connect-node-form" onSubmit={onSubmit} className="mt-5">
          <InputField
            form={form}
            name="nodeId"
            title="Node id"
            placeholder="<id>@<host>:3901"
            autoComplete="off"
            spellCheck={false}
            inputClassName="font-mono text-caption"
          />
        </form>

        {connectNode.error ? (
          <p role="alert" className="mt-3 text-bad [overflow-wrap:anywhere]">
            Not connected: {connectNode.error.message}
          </p>
        ) : null}
      </Dialog>
    </>
  );
};

export default ConnectNodeDialog;
