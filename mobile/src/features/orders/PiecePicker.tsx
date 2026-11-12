import { listJewelry, type JewelrySummary } from "@jewelry/core";
import { formatMoney } from "@jewelry/shared";
import { useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton } from "@/components/Button";
import { TextField } from "@/components/fields";
import { pieceLabel } from "@/components/JewelryCard";
import { EmptyState, Thumb } from "@/components/layout";
import { Text } from "@/components/Text";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { TOUCH_TARGET, useModalAnimation, useTheme } from "@/theme";

/** Full-screen list of pieces not already in an order. */
export function PiecePicker({
  exclude,
  onPick,
  onClose,
}: {
  exclude: string[];
  onPick: (piece: JewelrySummary) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const animation = useModalAnimation();
  const [search, setSearch] = useState("");
  const { data } = useLiveQuery((s) => listJewelry(s, { availability: "available", search, limit: 300 }), [search]);
  const items = (data ?? []).filter((j) => !exclude.includes(j.id));

  return (
    <Modal visible animationType={animation} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text variant="heading" style={{ flex: 1 }}>
            Add an available piece
          </Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <TextField label="Search pieces" value={search} onChangeText={setSearch} autoCorrect={false} />
        </View>
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="diamond-outline" title="No available pieces" body="Pieces already in an order are not listed." />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${pieceLabel(item)}, ${item.description}, cost ${formatMoney(item.totalCost)}`}
              onPress={() => onPick(item)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: TOUCH_TARGET + 16,
                padding: 8,
                borderRadius: 10,
                backgroundColor: pressed ? colors.accentSoft : colors.surface,
              })}
            >
              <Thumb image={item.image} size={56} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" color={colors.accent}>
                  {pieceLabel(item)}
                </Text>
                <Text numberOfLines={2}>{item.description}</Text>
              </View>
              <Text variant="money">{formatMoney(item.totalCost)}</Text>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
