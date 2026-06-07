import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { StatusBar } from "expo-status-bar";

type Screen =
  | "welcome"
  | "signup"
  | "kyc"
  | "card"
  | "eligibility"
  | "offer"
  | "review"
  | "payout"
  | "history"
  | "support";

type Tx = {
  id: string;
  brand: string;
  faceValue: number;
  offer: number;
  status: string;
};

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8080";

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [email, setEmail] = useState("");
  const [brand, setBrand] = useState("Visa Prepaid");
  const [last4, setLast4] = useState("");
  const [balance, setBalance] = useState("100");
  const [kycStatus, setKycStatus] = useState<"Not started" | "Pending" | "Verified">("Not started");
  const [eligibility, setEligibility] = useState<"Not checked" | "Eligible" | "Needs review" | "Ineligible">("Not checked");
  const [transactions, setTransactions] = useState<Tx[]>([]);

  const faceValue = useMemo(() => {
    const n = Number(balance.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [balance]);

  const offer = Math.max(0, Math.floor(faceValue * 0.82 * 100) / 100);

  function go(next: Screen) {
    setScreen(next);
  }

  function fakeSignup() {
    if (!email.includes("@")) {
      Alert.alert("Email needed", "Use a real email format for the prototype.");
      return;
    }
    go("kyc");
  }

  function fakeKyc() {
    setKycStatus("Pending");
    setTimeout(() => {
      setKycStatus("Verified");
      Alert.alert("KYC demo complete", "Prototype status set to Verified.");
      go("card");
    }, 400);
  }

  function checkEligibility() {
    if (faceValue < 10) {
      setEligibility("Ineligible");
    } else if (!last4 || last4.length < 4) {
      setEligibility("Needs review");
    } else {
      setEligibility("Eligible");
    }
    go("eligibility");
  }

  function acceptOffer() {
    const tx: Tx = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      brand,
      faceValue,
      offer,
      status: "Review pending"
    };
    setTransactions([tx, ...transactions]);
    go("review");
  }

  function releaseDemoPayout() {
    setTransactions((rows) =>
      rows.map((tx, idx) =>
        idx === 0 ? { ...tx, status: "Paid" } : tx
      )
    );
    go("payout");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d1117" }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Header screen={screen} onHome={() => go("welcome")} />

        {screen === "welcome" && (
          <Card>
            <Text style={styles.hero}>Turn eligible cards into cash safely.</Text>
            <Text style={styles.body}>
              CardHarbor is a compliance-first prototype for verified users, transparent offers,
              fraud review, and secure payouts.
            </Text>
            <Info label="API target" value={apiUrl} />
            <Primary title="Start secure exchange" onPress={() => go("signup")} />
            <Secondary title="View transaction history" onPress={() => go("history")} />
          </Card>
        )}

        {screen === "signup" && (
          <Card>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.body}>
              Production requires email verification, phone OTP, secure auth, and device controls.
            </Text>
            <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" />
            <Input label="Password" value="••••••••••" onChangeText={() => {}} placeholder="password" secure />
            <Primary title="Create account" onPress={fakeSignup} />
          </Card>
        )}

        {screen === "kyc" && (
          <Card>
            <Text style={styles.title}>Identity verification</Text>
            <Text style={styles.body}>
              Before payout, users complete KYC, sanctions screening, and payout name matching.
            </Text>
            <Info label="KYC status" value={kycStatus} />
            <Primary title="Run demo KYC" onPress={fakeKyc} />
          </Card>
        )}

        {screen === "card" && (
          <Card>
            <Text style={styles.title}>Add card</Text>
            <Text style={styles.body}>
              Only enter safe masked details in this prototype. Do not collect raw card secrets here.
            </Text>
            <Input label="Card brand" value={brand} onChangeText={setBrand} placeholder="Visa Prepaid" />
            <Input label="Last 4 / masked ID" value={last4} onChangeText={setLast4} placeholder="1234" keyboardType="numeric" />
            <Input label="Declared balance" value={balance} onChangeText={setBalance} placeholder="100" keyboardType="numeric" />
            <Primary title="Check eligibility" onPress={checkEligibility} />
          </Card>
        )}

        {screen === "eligibility" && (
          <Card>
            <Text style={styles.title}>Eligibility result</Text>
            <Info label="Result" value={eligibility} />
            <Info label="Brand" value={brand} />
            <Info label="Declared value" value={`$${faceValue.toFixed(2)}`} />
            {eligibility === "Eligible" ? (
              <Primary title="Generate offer" onPress={() => go("offer")} />
            ) : (
              <Secondary title="Back to card entry" onPress={() => go("card")} />
            )}
          </Card>
        )}

        {screen === "offer" && (
          <Card>
            <Text style={styles.title}>Offer</Text>
            <Info label="Card value" value={`$${faceValue.toFixed(2)}`} />
            <Info label="Estimated rate" value="82%" />
            <Info label="Estimated payout" value={`$${offer.toFixed(2)}`} />
            <Text style={styles.warning}>
              Final payout requires KYC verification, ownership proof, partner validation,
              risk review, and approval.
            </Text>
            <Primary title="Accept offer and continue" onPress={acceptOffer} />
            <Secondary title="Cancel" onPress={() => go("card")} />
          </Card>
        )}

        {screen === "review" && (
          <Card>
            <Text style={styles.title}>Security review</Text>
            <Text style={styles.body}>
              Demo transaction is now in review. Real production should use risk scoring,
              manual review, audit logs, and compliance escalation.
            </Text>
            <Info label="Status" value="Review pending" />
            <Primary title="Approve demo payout" onPress={releaseDemoPayout} />
            <Secondary title="Open support" onPress={() => go("support")} />
          </Card>
        )}

        {screen === "payout" && (
          <Card>
            <Text style={styles.title}>Payout complete</Text>
            <Text style={styles.body}>
              In production, payouts should only go to verified user-owned destinations.
            </Text>
            <Info label="Demo payout" value={`$${offer.toFixed(2)}`} />
            <Primary title="View history" onPress={() => go("history")} />
          </Card>
        )}

        {screen === "history" && (
          <Card>
            <Text style={styles.title}>Transaction history</Text>
            {transactions.length === 0 ? (
              <Text style={styles.body}>No transactions yet.</Text>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.historyRow}>
                  <Text style={styles.rowTitle}>{tx.id} · {tx.brand}</Text>
                  <Text style={styles.body}>Value ${tx.faceValue.toFixed(2)} → Offer ${tx.offer.toFixed(2)}</Text>
                  <Text style={styles.badge}>{tx.status}</Text>
                </View>
              ))
            )}
            <Primary title="New card" onPress={() => go("card")} />
            <Secondary title="Support" onPress={() => go("support")} />
          </Card>
        )}

        {screen === "support" && (
          <Card>
            <Text style={styles.title}>Support / dispute</Text>
            <Text style={styles.body}>
              Users can open tickets for payout delays, verification issues, denials,
              disputes, and account questions.
            </Text>
            <Input label="Subject" value="Payout question" onChangeText={() => {}} placeholder="Subject" />
            <Input label="Message" value="I need help with my transaction." onChangeText={() => {}} placeholder="Message" />
            <Primary title="Create demo ticket" onPress={() => Alert.alert("Ticket created", "Demo support ticket created.")} />
            <Secondary title="Back home" onPress={() => go("welcome")} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ screen, onHome }: { screen: string; onHome: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>CardHarbor</Text>
      <TouchableOpacity onPress={onHome}>
        <Text style={styles.home}>Home</Text>
      </TouchableOpacity>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Input(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#718096"
        secureTextEntry={props.secure}
        keyboardType={props.keyboardType || "default"}
        style={styles.input}
      />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Primary({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.primary}>
      <Text style={styles.primaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

function Secondary({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.secondary}>
      <Text style={styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = {
  header: {
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const
  },
  logo: {
    color: "#79ffe1",
    fontSize: 22,
    fontWeight: "800" as const
  },
  home: {
    color: "#c9d1d9",
    fontSize: 16
  },
  card: {
    backgroundColor: "#161b22",
    borderColor: "#30363d",
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14
  },
  hero: {
    color: "#f0f6fc",
    fontSize: 34,
    fontWeight: "900" as const,
    lineHeight: 40
  },
  title: {
    color: "#f0f6fc",
    fontSize: 26,
    fontWeight: "800" as const
  },
  body: {
    color: "#c9d1d9",
    fontSize: 15,
    lineHeight: 22
  },
  warning: {
    color: "#ffd580",
    fontSize: 14,
    lineHeight: 21
  },
  label: {
    color: "#8b949e",
    fontSize: 13,
    fontWeight: "700" as const
  },
  input: {
    color: "#f0f6fc",
    backgroundColor: "#0d1117",
    borderColor: "#30363d",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16
  },
  primary: {
    backgroundColor: "#2ea043",
    borderRadius: 16,
    padding: 15,
    alignItems: "center" as const
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800" as const
  },
  secondary: {
    borderColor: "#30363d",
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    alignItems: "center" as const
  },
  secondaryText: {
    color: "#c9d1d9",
    fontSize: 16,
    fontWeight: "700" as const
  },
  info: {
    backgroundColor: "#0d1117",
    borderRadius: 14,
    padding: 13,
    borderColor: "#30363d",
    borderWidth: 1
  },
  infoLabel: {
    color: "#8b949e",
    fontSize: 12,
    fontWeight: "700" as const
  },
  infoValue: {
    color: "#f0f6fc",
    fontSize: 18,
    fontWeight: "800" as const,
    marginTop: 3
  },
  historyRow: {
    backgroundColor: "#0d1117",
    borderRadius: 14,
    padding: 13,
    borderColor: "#30363d",
    borderWidth: 1,
    gap: 5
  },
  rowTitle: {
    color: "#f0f6fc",
    fontSize: 16,
    fontWeight: "800" as const
  },
  badge: {
    color: "#79ffe1",
    fontWeight: "800" as const
  }
};
