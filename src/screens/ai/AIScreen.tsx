// src/screens/ai/AIScreen.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

import { Colors, Typography, Spacing, Radius, Shadow } from '../../theme';
import { aiAPI } from '../../services/api';
import { AIMessage } from '../../types';

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Best seller ngayon?', icon: 'trophy-outline' },
  { label: 'Low stocks?', icon: 'warning-outline' },
  { label: 'Kita ngayon?', icon: 'cash-outline' },
  { label: 'I-prep bukas?', icon: 'calendar-outline' },
  { label: 'EOD Report', icon: 'document-text-outline' },
] as const;

// ─── Greeting ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Magandang umaga!';
  if (h < 17) return 'Magandang tanghali!';
  return 'Magandang gabi!';
}

const INITIAL_MESSAGE: AIMessage = {
  id: 'init',
  role: 'assistant',
  content: `${getGreeting()} 👋 Ako ang iyong AI assistant para sa Little Giant POS. Anong maitutulong ko sa iyo ngayon? Pwede kang magtanong tungkol sa sales, stocks, o kahit ano pang business matter mo.`,
  timestamp: new Date().toISOString(),
};

// ─── Bubble ──────────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: AIMessage }) {
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="flash" size={14} color={Colors.white} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {format(new Date(msg.timestamp), 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.bubbleRow}>
      <View style={styles.avatar}>
        <Ionicons name="flash" size={14} color={Colors.white} />
      </View>
      <View style={[styles.bubble, styles.bubbleBot]}>
        <Text style={styles.bubbleText}>Nagta-type...</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AIScreen() {
  const [messages, setMessages] = useState<AIMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: AIMessage = {
      id: uuid(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const history = messages
        .filter(m => m.id !== 'init')
        .map(m => ({ role: m.role, content: m.content }));

      let responseText: string;

      if (trimmed === 'EOD Report') {
        const res = await aiAPI.generateEOD();
        responseText = res.report;
      } else {
        const res = await aiAPI.chat(trimmed, history);
        responseText = res.response;
      }

      const botMsg: AIMessage = {
        id: uuid(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      const errMsg: AIMessage = {
        id: uuid(),
        role: 'assistant',
        content: 'Sorry, hindi ako makakonekta sa server ngayon. Try ulit mamaya, ha? 😅',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [messages, loading]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="flash" size={20} color={Colors.white} />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSub}>Powered by Claude · Taglish mode</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
          {loading && <TypingIndicator />}
        </ScrollView>

        {/* Quick actions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickContent}
        >
          {QUICK_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.label}
              style={styles.quickChip}
              onPress={() => sendMessage(a.label)}
              disabled={loading}
            >
              <Ionicons name={a.icon as any} size={13} color={Colors.primary} />
              <Text style={styles.quickChipText}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Magtanong ka..."
            placeholderTextColor={Colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Ionicons name="send" size={18} color={Colors.white} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },

  messageList: { flex: 1 },
  messageContent: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.lg },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, maxWidth: '85%' },
  bubbleRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },

  avatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  bubble: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxWidth: '100%' },
  bubbleBot: { backgroundColor: Colors.white, ...Shadow.sm, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },

  bubbleText: { fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 20 },
  bubbleTextUser: { color: Colors.white },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)' },

  quickScroll: { maxHeight: 48, backgroundColor: Colors.white, borderTopWidth: 0.5, borderTopColor: Colors.border },
  quickContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm, alignItems: 'center' },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.primaryBg, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.primaryLight,
  },
  quickChipText: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.primary },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.white, borderTopWidth: 0.5, borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1, backgroundColor: Colors.bgSecondary, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: Typography.base, color: Colors.textPrimary, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: Radius.full,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.gray300 },
});
