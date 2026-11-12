import { listPurchases } from "@jewelry/core";
import { formatMoney } from "@jewelry/shared";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Fab } from "@/components/Button";
import { formatDate } from "@/components/fields";
import { EmptyState, ListRow, Screen } from "@/components/layout";
import { useLiveQuery } from "@/hooks/useLiveQuery";

export default function PurchasesScreen() {
  const router = useRouter();
  const { data, loading } = useLiveQuery((s) => listPurchases(s, { limit: 300 }), []);
  return (
    <View style={{ flex: 1 }}>
      <Screen>
        {!loading && data?.length === 0 ? (
          <EmptyState icon="cart-outline" title="No purchases yet" body="Record what you buy from suppliers; the latest price fills in piece costs." />
        ) : (
          (data ?? []).map((p) => (
            <ListRow
              key={p.id}
              icon="cart-outline"
              title={`${p.supplierName} · ${formatDate(p.purchaseDate)}`}
              subtitle={`${p.lineCount} item(s) · ${formatMoney(p.total)}`}
              onPress={() => router.push({ pathname: "/purchases/edit", params: { id: p.id } })}
            />
          ))
        )}
      </Screen>
      <Fab label="New purchase" onPress={() => router.push("/purchases/edit")} />
    </View>
  );
}
