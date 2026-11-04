import {
  useAssignNode,
  useClusterLayout,
  useClusterStatus,
  getStatusNodes,
} from "../hooks";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AssignNodeSchema,
  assignNodeSchema,
  capacityUnits,
  calculateCapacity,
  parseCapacity,
} from "../schema";
import { toast } from "sonner";
import { useEffect, useId, useMemo } from "react";
import { assignNodeDialog } from "../stores";
import { buildRows } from "../model";
import FormControl from "@/components/ui/form-control";
import Dialog from "@/components/ui/dialog";
import Button from "@/components/ui/button";
import Input, { inputClass } from "@/components/ui/input";
import Toggle from "@/components/ui/toggle";
import TagInput from "@/components/ui/tag-input";
import { cn, handleError } from "@/lib/utils";

const defaultValues: AssignNodeSchema = {
  nodeId: "",
  zone: "",
  capacity: 1,
  capacityUnit: "GB",
  isGateway: false,
  tags: [],
};

const unique = (values: (string | undefined | null)[]) => [
  ...new Set(values.filter((value): value is string => !!value)),
];

const AssignNodeDialog = () => {
  const { isOpen, data } = assignNodeDialog.use();
  const { data: cluster } = useClusterStatus();
  const { data: layout } = useClusterLayout();
  const zoneListId = useId();

  const form = useForm<AssignNodeSchema>({
    resolver: zodResolver(assignNodeSchema),
    defaultValues,
  });
  const { reset } = form;
  const isGateway = useWatch({ control: form.control, name: "isGateway" });

  const assignNode = useAssignNode({
    onSuccess() {
      form.reset();
      toast.success("Node staged for assignment");
      assignNodeDialog.close();
    },
    // The dialog stays open with the error.
    onError: handleError,
  });
  const { reset: resetMutation } = assignNode;

  useEffect(() => {
    if (data) {
      resetMutation();
      const hasCapacity = data.capacity != null && data.capacity > 0;
      const cap = hasCapacity ? parseCapacity(data.capacity) : null;

      reset({
        ...defaultValues,
        ...data,
        capacity: cap ? cap.value : defaultValues.capacity,
        capacityUnit: cap?.unit ?? defaultValues.capacityUnit,
        isGateway: data.capacity === null,
      });
    }
  }, [data, reset, resetMutation]);

  const rows = useMemo(
    () => buildRows(getStatusNodes(cluster), layout),
    [cluster, layout],
  );
  const zoneList = useMemo(() => unique(rows.map((r) => r.zone)), [rows]);
  const tagsList = useMemo(() => unique(rows.flatMap((r) => r.tags)), [rows]);

  const onSubmit = form.handleSubmit((values) => {
    assignNode.mutate({
      id: values.nodeId,
      zone: values.zone.trim(),
      capacity: !values.isGateway
        ? calculateCapacity(values.capacity, values.capacityUnit)
        : null,
      tags: values.tags,
    });
  });

  const close = () => {
    if (!assignNode.isPending) assignNodeDialog.close();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={close}
      title="Assign node"
      description="Stages a role for this node. Nothing changes until the layout is applied."
      size="lg"
      dismissible={!assignNode.isPending}
      actions={
        <>
          <Button onClick={close} disabled={assignNode.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="assign-node-form"
            variant="primary"
            loading={assignNode.isPending}
          >
            Stage assignment
          </Button>
        </>
      }
    >
      <form id="assign-node-form" onSubmit={onSubmit} className="grid gap-4">
        <FormControl
          form={form}
          name="nodeId"
          title="Node id"
          render={(field, { id }) => (
            <Input
              id={id}
              className="[overflow-wrap:anywhere]"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              readOnly
              title={field.value}
            />
          )}
        />

        <FormControl
          form={form}
          name="zone"
          title="Zone"
          hint="Pick an existing zone or type a new one."
          render={(field, { id, describedBy, fieldState }) => (
            <>
              <Input
                id={id}
                list={zoneListId}
                placeholder="e.g. dc1"
                autoComplete="off"
                spellCheck={false}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={fieldState.error ? true : undefined}
                aria-describedby={describedBy}
              />
              <datalist id={zoneListId}>
                {zoneList.map((zone) => (
                  <option key={zone} value={zone} />
                ))}
              </datalist>
            </>
          )}
        />

        <div className="grid gap-3">
          <Controller
            control={form.control}
            name="isGateway"
            render={({ field }) => (
              <Toggle
                label="Gateway only"
                description="Gateway nodes route requests and store no data."
                name={field.name}
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />

          {!isGateway ? (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
              <FormControl
                form={form}
                name="capacity"
                title="Capacity"
                render={(field, { id, describedBy, fieldState }) => (
                  <Input
                    id={id}
                    type="number"
                    step="any"
                    min={0}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
                    aria-invalid={fieldState.error ? true : undefined}
                    aria-describedby={describedBy}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? null : e.target.valueAsNumber,
                      )
                    }
                  />
                )}
              />
              <FormControl
                form={form}
                name="capacityUnit"
                title="Unit"
                render={(field, { id }) => (
                  <select
                    id={id}
                    className={cn(inputClass, "w-auto min-w-[4.5rem]")}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={field.onChange}
                  >
                    {capacityUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          ) : null}
        </div>

        <FormControl
          form={form}
          name="tags"
          render={(field, { id }) => (
            <TagInput
              id={id}
              label="Tags"
              value={field.value ?? []}
              onChange={field.onChange}
              suggestions={tagsList}
            />
          )}
        />
      </form>

      {assignNode.error ? (
        <p role="alert" className="mt-3 text-bad [overflow-wrap:anywhere]">
          Not staged: {assignNode.error.message}
        </p>
      ) : null}
    </Dialog>
  );
};

export default AssignNodeDialog;
