import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components";

interface BoardItem {
  text: string;
}

interface CompletedItem {
  text: string;
  completedAt: Date;
}

interface BrainDispatchProps {
  firstName: string;
  tasks: BoardItem[];
  ideas: BoardItem[];
  thoughts: BoardItem[];
  emotions: BoardItem[];
  completedItems: CompletedItem[];
  fuelLevel: number | null;
  appUrl: string;
  unsubscribeUrl: string;
  dateString: string;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

const colors = {
  cream: "#FAF8F5",
  bark: "#5D4E43",
  barkDeep: "#3D2E23",
  coral: "#E8927C",
  lavender: "#B8A9D4",
  marigold: "#D4A020",
  sage: "#6E9A6F",
  purple: "#8A7BB8",
  divider: "#E8E4DF",
};

export default function BrainDispatch({
  firstName,
  tasks,
  ideas,
  thoughts,
  emotions,
  completedItems,
  fuelLevel,
  appUrl,
  unsubscribeUrl,
  dateString,
}: BrainDispatchProps) {
  const totalActive = tasks.length + ideas.length + thoughts.length + emotions.length;
  const preheaderParts: string[] = [];
  if (tasks.length) preheaderParts.push(`${tasks.length} task${tasks.length > 1 ? "s" : ""}`);
  if (ideas.length) preheaderParts.push(`${ideas.length} idea${ideas.length > 1 ? "s" : ""}`);
  if (completedItems.length) preheaderParts.push(`${completedItems.length} recently completed`);
  const preheader = preheaderParts.join(" · ") || "Your board is clear! 🌿";

  return (
    <Html lang="en">
      <Head />
      <Preview>{preheader}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Text style={styles.greeting}>
            Hey {firstName || "there"} 👋
          </Text>
          <Text style={styles.subGreeting}>
            Here's your board right now:
          </Text>

          <Hr style={styles.hr} />

          {/* Tasks */}
          {tasks.length > 0 && (
            <Section style={styles.section}>
              <Text style={{ ...styles.sectionHeader, color: colors.coral }}>
                🔲 Tasks ({tasks.length} active)
              </Text>
              {tasks.map((item, i) => (
                <Text key={i} style={styles.item}>· {item.text}</Text>
              ))}
            </Section>
          )}

          {/* Ideas */}
          {ideas.length > 0 && (
            <Section style={styles.section}>
              <Text style={{ ...styles.sectionHeader, color: colors.marigold }}>
                💡 Ideas ({ideas.length} spark{ideas.length > 1 ? "s" : ""})
              </Text>
              {ideas.map((item, i) => (
                <Text key={i} style={styles.item}>· {item.text}</Text>
              ))}
            </Section>
          )}

          {/* Thoughts */}
          {thoughts.length > 0 && (
            <Section style={styles.section}>
              <Text style={{ ...styles.sectionHeader, color: colors.purple }}>
                💭 Thoughts ({thoughts.length} noted)
              </Text>
              {thoughts.map((item, i) => (
                <Text key={i} style={styles.item}>· {item.text}</Text>
              ))}
            </Section>
          )}

          {/* Emotions */}
          {emotions.length > 0 && (
            <Section style={styles.section}>
              <Text style={{ ...styles.sectionHeader, color: colors.sage }}>
                💚 Emotions ({emotions.length} logged)
              </Text>
              {emotions.map((item, i) => (
                <Text key={i} style={styles.item}>· {item.text}</Text>
              ))}
            </Section>
          )}

          {/* Empty board */}
          {totalActive === 0 && (
            <Section style={styles.section}>
              <Text style={styles.emptyState}>
                Your board is clear! Nothing pending. 🌿
              </Text>
            </Section>
          )}

          {/* Completed */}
          {completedItems.length > 0 && (
            <>
              <Hr style={styles.hr} />
              <Section style={styles.section}>
                <Text style={{ ...styles.sectionHeader, color: colors.sage }}>
                  ✅ Completed recently
                </Text>
                {completedItems.map((item, i) => (
                  <Text key={i} style={styles.completedItem}>
                    · {item.text} ({formatRelativeDate(item.completedAt)})
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Hr style={styles.hr} />

          {/* Fuel level */}
          {fuelLevel != null && (
            <Text style={styles.fuelLevel}>
              Your last fuel level: {"⚡".repeat(fuelLevel)}{"  "}{fuelLevel}/5
            </Text>
          )}

          {/* CTA */}
          <Section style={styles.ctaSection}>
            <Link href={appUrl} style={styles.ctaButton}>
              Open Brain Dump →
            </Link>
          </Section>

          <Hr style={styles.hr} />

          {/* Footer */}
          <Text style={styles.footer}>
            To change how often you get this:{" "}
            <Link href={appUrl} style={styles.footerLink}>Settings</Link>
            {" · "}
            <Link href={unsubscribeUrl} style={styles.footerLink}>Unsubscribe</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    backgroundColor: colors.cream,
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    margin: 0,
    padding: 0,
  },
  container: {
    maxWidth: "520px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  greeting: {
    fontSize: "22px",
    fontWeight: 600,
    color: colors.barkDeep,
    margin: "0 0 4px",
  },
  subGreeting: {
    fontSize: "15px",
    color: colors.bark,
    margin: "0 0 20px",
    opacity: 0.8,
  },
  hr: {
    borderColor: colors.divider,
    borderWidth: "1px 0 0 0",
    margin: "20px 0",
  },
  section: {
    marginBottom: "16px",
  },
  sectionHeader: {
    fontSize: "15px",
    fontWeight: 700,
    margin: "0 0 6px",
  },
  item: {
    fontSize: "14px",
    color: colors.bark,
    margin: "0 0 3px",
    paddingLeft: "4px",
    lineHeight: "1.5",
  },
  completedItem: {
    fontSize: "14px",
    color: colors.bark,
    margin: "0 0 3px",
    paddingLeft: "4px",
    lineHeight: "1.5",
    opacity: 0.65,
    textDecoration: "line-through" as const,
  },
  emptyState: {
    fontSize: "15px",
    color: colors.bark,
    textAlign: "center" as const,
    padding: "24px 0",
    opacity: 0.7,
  },
  fuelLevel: {
    fontSize: "14px",
    color: colors.bark,
    margin: "0 0 16px",
  },
  ctaSection: {
    textAlign: "center" as const,
    margin: "8px 0",
  },
  ctaButton: {
    display: "inline-block",
    backgroundColor: colors.lavender,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 28px",
    borderRadius: "24px",
    textDecoration: "none",
  },
  footer: {
    fontSize: "12px",
    color: colors.bark,
    opacity: 0.5,
    textAlign: "center" as const,
    margin: 0,
  },
  footerLink: {
    color: colors.bark,
    textDecoration: "underline",
  },
};
