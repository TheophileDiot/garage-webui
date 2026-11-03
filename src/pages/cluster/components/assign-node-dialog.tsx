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
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { assignNodeDialog } from "../stores";
import { GetClusterLayoutResult } from "../types";
import FormControl from "@/components/ui/form-control";
import Select2, { SelectOption } from "@/components/ui/select";
import Dialog from "@/components/ui/dialog";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Checkbox from "@/components/ui/checkbox";

const defaultValues: AssignNodeSchema = {
  nodeId: "",
  zone: "",
  capacity: 1,
  capacityUnit: "GB",
  isGateway: false,
  tags: [],
};

const toOptions = (values: (string | undefined)[]): SelectOption[] =>
  [...new Set(values.filter((value): value is string => !!value))].map(
    (value) => ({ label: value, value }),
  );

const roleOf = (
  layout: GetClusterLayoutResult | undefined,
  id: string,
  fallback: { zone?: string; tags?: string[] } | undefined,
) => {
  const role = layout?.roles.find((r) => r.id === id);
  const staged = layout?.stagedRoleChanges.find((r) => r.id === id);
  return {
    zone: staged?.zone || role?.zone || fallback?.zone,
    tags: staged?.tags || role?.tags || fallback?.tags,
  };
};

const AssignNodeDialog = () => {
  const { isOpen, data } = assignNodeDialog.use();
  const { data: cluster } = useClusterStatus();
  const { data: layout } = useClusterLayout();
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["status"] });
      queryClient.invalidateQueries({ queryKey: ["layout"] });
      assignNodeDialog.close();
    },
    onError(err) {
      toast.error(err?.message || "Unknown error");
    },
  });

  useEffect(() => {
    if (data) {
      const cap = parseCapacity(data.capacity);

      reset({
        ...defaultValues,
        ...data,
        capacity: cap.value,
        capacityUnit: cap.unit ?? defaultValues.capacityUnit,
        isGateway: data.capacity === null,
      });
    }
  }, [data, reset]);

  const nodes = useMemo(() => getStatusNodes(cluster), [cluster]);

  const zoneList = useMemo(
    () =>
      toOptions(nodes.map((node) => roleOf(layout, node.id, node.role).zone)),
    [nodes, layout],
  );
  const tagsList = useMemo(
    () =>
      toOptions(
        nodes.flatMap((node) => roleOf(layout, node.id, node.role).tags ?? []),
      ),
    [nodes, layout],
  );

  const onSubmit = form.handleSubmit((values) => {
    assignNode.mutate({
      id: values.nodeId,
      zone: values.zone,
      capacity: !values.isGateway
        ? calculateCapacity(values.capacity, values.capacityUnit)
        : null,
      tags: values.tags,
    });
  });

  return (
    <Dialog
      open={isOpen}
      onClose={assignNodeDialog.close}
      title="Assign node"
      className="max-w-xl"
      actions={
        <>
          <Button onClick={assignNodeDialog.close}>Cancel</Button>
          <Button
            type="submit"
            form="assign-node-form"
            color="primary"
            loading={assignNode.isPending}
          >
            Stage assignment
          </Button>
        </>
      }
    >
      <form id="assign-node-form" onSubmit={onSubmit} className="space-y-3">
        <div className="form-control">
          <label htmlFor="assign-node-id" className="label label-text">
            Node id
          </label>
          <Input
            id="assign-node-id"
            className="mono w-full"
            {...form.register("nodeId")}
            readOnly
          />
        </div>

        <FormControl
          form={form}
          name="zone"
          title="Zone"
          render={(field, { id }) => (
            <Select2
              creatable
              inputId={id}
              name={field.name}
              onBlur={field.onBlur}
              value={
                field.value ? { label: field.value, value: field.value } : null
              }
              options={zoneList}
              placeholder="e.g. dc1"
              onChange={(option) =>
                field.onChange((option as SelectOption | null)?.value ?? "")
              }
            />
          )}
        />

        <div>
          <div className="flex items-center justify-between">
            <span className="label label-text">Capacity</span>
            <Controller
              control={form.control}
              name="isGateway"
              render={({ field }) => (
                <Checkbox
                  label="Gateway only"
                  name={field.name}
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
          </div>

          {!isGateway ? (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <FormControl
                form={form}
                name="capacity"
                render={(field, { id }) => (
                  <Input
                    id={id}
                    type="number"
                    step="any"
                    min={0}
                    aria-label="Capacity"
                    className="w-full"
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ""}
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
                render={(field, { id }) => (
                  <select
                    id={id}
                    aria-label="Capacity unit"
                    className="select select-bordered"
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
          ) : (
            <p className="muted text-sm">
              Gateway nodes route requests and store no data.
            </p>
          )}
        </div>

        <FormControl
          form={form}
          name="tags"
          title="Tags"
          render={(field, { id }) => (
            <Select2
              creatable
              isMulti
              inputId={id}
              name={field.name}
              onBlur={field.onBlur}
              value={(field.value ?? []).map((value) => ({
                label: value,
                value,
              }))}
              options={tagsList}
              placeholder="Add tags"
              onChange={(values) =>
                field.onChange(
                  (values as readonly SelectOption[]).map(
                    (value) => value.value,
                  ),
                )
              }
            />
          )}
        />
      </form>
    </Dialog>
  );
};

export default AssignNodeDialog;
