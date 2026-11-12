import { DomainError, listTrash, restore, type TrashEntry } from "@jewelry/core";
import { TRASH_RETENTION_DAYS, type TableName } from "@jewelry/shared";
import { Alert } from "react-native";
import { IconButton } from "@/components/Button";
import { EmptyState, ListRow, Screen } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useStore } from "@/providers/app";

const KIND: Partial<Record<TableName, string>> = {
  clients: "Client",
  suppliers: "Supplier",
  materials: "Material",
  purchases: "Purchase",
  stockAdjustments: "Stock adjustment",
  jewelries: "Piece",
  jobOrders: "Job order",
};

const DAY = 86_400_000;

function daysLeft(deletedAt: string): number {
  const left = Math.ceil((Date.parse(deletedAt) + TRASH_RETENTION_DAYS * DAY - Date.now()) / DAY);
  return Math.max(0, left);
}

export default function TrashScreen() {
  const store = useStore();
  const { data, loading } = useLiveQuery((s) => listTrash(s), []);

  const undo = async (e: TrashEntry) => {
    try {
      await restore(store, e.table, e.id);
    } catch (err) {
      Alert.alert("Can't restore", err instanceof DomainError ? err.message : "Please try again.");
    }
  };

  return (
    <Screen testID="trash">
      <Text muted>
        Deleted records stay here for {TRASH_RETENTION_DAYS} days. After that they are removed, or kept out of sight if older orders still refer to them.
      </Text>
      {!loading && data?.length === 0 ? (
        <EmptyState icon="trash-outline" title="Trash is empty" />
      ) : (
        (data ?? []).map((e) => {
          const left = daysLeft(e.deletedAt);
          return (
            <ListRow
              key={`${e.table}:${e.id}`}
              title={e.label}
              subtitle={`${KIND[e.table] ?? e.table} · ${left === 0 ? "removed soon" : `${left} day(s) left`}`}
              trailing={<IconButton icon="arrow-undo-outline" label={`Restore ${e.label}`} onPress={() => undo(e)} />}
            />
          );
        })
      )}
    </Screen>
  );
}
