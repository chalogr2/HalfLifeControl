import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Typography, Input } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import { searchDrugs, type DrugEntry } from '@/data/drugDatabase';
import { searchOpenFDA, type OpenFDAResult } from '@/services/openfda';

interface SearchResult {
  type: 'curated' | 'openfda' | 'manual';
  name: string;
  subtitle: string;
  drug?: DrugEntry;
  fdaResult?: OpenFDAResult;
}

interface DrugSearchBarProps {
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

export function DrugSearchBar({ onSelect, placeholder = 'Search or type a drug name...' }: DrugSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (text: string) => {
    if (text.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // 1. Curated DB (instant)
    const curated: SearchResult[] = searchDrugs(text).map((drug) => ({
      type: 'curated' as const,
      name: drug.name,
      subtitle: `${drug.brands.join(', ')} · ${drug.halfLifeLabel} half-life`,
      drug,
    }));

    // Show curated results immediately + manual fallback
    const manual: SearchResult = {
      type: 'manual',
      name: text.trim(),
      subtitle: 'Enter details manually',
    };
    setResults([...curated, manual]);
    setShowResults(true);

    // 2. openFDA search (async, only if curated didn't find much)
    if (curated.length < 3 && text.length >= 3) {
      setLoading(true);
      try {
        const fdaResults = await searchOpenFDA(text, 5);
        const fdaMapped: SearchResult[] = fdaResults
          .filter((r) => !curated.some((c) => c.name.toLowerCase() === r.genericName.toLowerCase()))
          .map((r) => ({
            type: 'openfda' as const,
            name: r.genericName || r.brandName,
            subtitle: r.brandName ? `${r.brandName} (FDA)` : 'From FDA database',
            fdaResult: r,
          }));

        setResults((prev) => {
          // Insert FDA results before the manual entry
          const withoutManual = prev.filter((r) => r.type !== 'manual');
          return [...withoutManual, ...fdaMapped, manual];
        });
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(text), 200);
    },
    [search],
  );

  const handleSelect = useCallback(
    (item: SearchResult) => {
      setQuery(item.name);
      setShowResults(false);
      onSelect(item);
    },
    [onSelect],
  );

  return (
    <View style={styles.container}>
      <Input
        label="Drug name"
        placeholder={placeholder}
        value={query}
        onChangeText={handleChangeText}
        autoCapitalize="words"
        autoCorrect={false}
      />
      {loading && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      )}
      {showResults && results.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item.type}-${item.name}-${i}`}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.resultItem, pressed && styles.pressed]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.resultContent}>
                  <Typography variant="bodyLg" color="onSurface" numberOfLines={1}>
                    {item.name}
                  </Typography>
                  <Typography variant="labelMd" color="onSurfaceVariant" numberOfLines={1}>
                    {item.subtitle}
                  </Typography>
                </View>
                {item.type === 'curated' && (
                  <View style={styles.badge}>
                    <Typography variant="labelSm" color="onPrimary">HL</Typography>
                  </View>
                )}
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  spinner: {
    position: 'absolute',
    right: 12,
    top: 38,
  },
  dropdown: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    marginTop: spacing[1],
    maxHeight: 260,
    overflow: 'hidden',
  },
  list: {
    maxHeight: 260,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  pressed: {
    backgroundColor: colors.surfaceContainerHighest,
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    marginLeft: spacing[2],
  },
});

export type { SearchResult };
