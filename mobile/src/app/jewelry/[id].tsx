import { DomainError, getJewelry, softDelete } from "@jewelry/core";
import { COST_CATEGORIES, formatMoney, ORIGINS, PIECE_TYPES, suggestedPrice } from "@jewelry/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { Button, IconButton } from "@/components/Button";
import { formatDate } from "@/components/fields";
import { Badge, Card, Columns, Detail, EmptyState, ListRow, Loading, Screen, Section, Thumb } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useSettings } from "@/hooks/useSettings";
import { componentLabel, formatComponentSpecs, formatMetal, formatStone, trim } from "@/lib/format";
import { useStore } from "@/providers/app";
import { useTheme } from "@/theme";

export default function JewelryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const settings = useSettings();
  const { colors } = useTheme();
  const { data: detail, loading } = useLiveQuery((s) => getJewelry(s, id), [id]);

  if (loading) return <Loading />;
  if (!detail || detail.jewelry.deletedAt) {
    return <EmptyState icon="trash-outline" title="This piece was deleted" body="Restore it from Trash in More." />;
  }
  const { jewelry: j } = detail;
  const title = [j.code ?? "New piece", detail.pieceType ? PIECE_TYPES.labels[detail.pieceType] : null].filter(Boolean).join(" · ");

  const remove = () =>
    Alert.alert("Delete this piece?", "It moves to Trash for 7 days and can be restored.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await softDelete(store, "jewelries", j.id);
            router.back();
          } catch (e) {
            Alert.alert("Can't delete", e instanceof DomainError ? e.message : "Please try again.");
          }
        },
      },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <IconButton testID="edit-piece" icon="create-outline" label="Edit piece" onPress={() => router.push({ pathname: "/jewelry/edit", params: { id: j.id } })} />
          ),
        }}
      />
      <Screen testID="jewelry-detail">
        {detail.images.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} accessibilityLabel="Photos">
            {detail.images.map((im, i) => (
              <Thumb
                key={im.id}
                image={im}
                size={220}
                label={`${im.source === "ai" ? "AI design" : "Photo"} ${i + 1} of ${detail.images.length}`}
              />
            ))}
          </ScrollView>
        ) : null}

        <View style={{ gap: 6 }}>
          <Text variant="title">{title}</Text>
          <Text>{j.description}</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Badge label={ORIGINS.labels[j.origin]} />
            {detail.order ? <Badge label={`In ${detail.order.code ?? "an order"}`} tone="accent" icon="receipt-outline" /> : null}
          </View>
        </View>

        <Columns>
          <Card>
            <Detail label="Manufactured" value={j.manufactureDate ? formatDate(j.manufactureDate) : null} />
            <Detail label="Metal" value={j.sameMetalForAll ? formatMetal(j) : "Varies by part"} />
            <Detail label="Total weight" value={detail.totalWeightG ? `${trim(detail.totalWeightG)} g` : null} />
            <Detail label="Notes" value={j.notes} />
          </Card>
          <Card>
            <Detail label="Total cost" value={<Text variant="money">{formatMoney(detail.totalCost)}</Text>} />
            <Detail
              label={`Suggested price (+${settings.defaultMarkupPct}%)`}
              value={<Text variant="money" color={colors.accent}>{formatMoney(suggestedPrice(detail.totalCost, settings.defaultMarkupPct))}</Text>}
            />
          </Card>
        </Columns>

        {detail.order ? (
          <ListRow
            icon="receipt-outline"
            title={`Job order ${detail.order.code ?? "(pending code)"}`}
            subtitle="Open the order this piece belongs to"
            onPress={() => router.push(`/orders/${detail.order!.id}`)}
          />
        ) : null}

        <Section title="Parts">
          {detail.components.map((c) => (
            <Card key={c.id}>
              <Text variant="heading">{componentLabel(c)}</Text>
              <Detail label="Metal" value={j.sameMetalForAll ? "Same as piece" : formatMetal(c)} />
              <Detail label="Details" value={formatComponentSpecs(c, settings)} />
              {c.stones.length ? (
                <View style={{ gap: 4 }}>
                  <Text variant="label" muted>
                    Stones
                  </Text>
                  {c.stones.map((s) => (
                    <Text key={s.id}>• {formatStone(s)}</Text>
                  ))}
                </View>
              ) : (
                <Text variant="caption" muted>
                  No stones
                </Text>
              )}
              <Detail label="Notes" value={c.notes} />
            </Card>
          ))}
        </Section>

        <Section title="Costs">
          {detail.stoneCost > 0 ? (
            <ListRow icon="diamond-outline" title="Stones" subtitle="Priced per stone" trailing={<Text variant="money">{formatMoney(detail.stoneCost)}</Text>} />
          ) : null}
          {detail.costs.length === 0 && detail.stoneCost === 0 ? (
            <Text muted>No costs recorded yet.</Text>
          ) : (
            detail.costs.map((c) => (
              <ListRow
                key={c.id}
                title={c.description || COST_CATEGORIES.labels[c.category]}
                subtitle={[
                  COST_CATEGORIES.labels[c.category],
                  c.supplierName,
                  c.quantity !== 1 ? `${trim(c.quantity, 3)} × ${formatMoney(c.unitCost)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={<Text variant="money">{formatMoney(c.total)}</Text>}
              />
            ))
          )}
        </Section>

        <Button testID="delete-piece" label="Delete piece" variant="secondary" icon="trash-outline" onPress={remove} />
      </Screen>
    </>
  );
}
