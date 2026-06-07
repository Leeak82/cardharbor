import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "https://cardharbor.onrender.com";

type Brand = { name: string; rate: number };
type User = { id: number; email: string; role?: string };

type PayoutProfile = {
  preferred_method?: string;
  cashapp_tag?: string;
  venmo_handle?: string;
  bank_name?: string;
  account_last4?: string;
  routing_last4?: string;
};

type Transaction = {
  id: number;
  user_email?: string;
  brand: string;
  detected_brand?: string;
  balance: number;
  detected_balance?: number | null;
  rate?: number;
  offer: number;
  payout_method: string;
  image_url?: string | null;
  ocr_text?: string;
  ocr_error?: string | null;
  possible_codes?: string[];
  admin_note?: string;
  payout_note?: string;
  payout_reference?: string;
  paid_at?: string;
  payout_profile?: PayoutProfile | null;
  risk_score?: number;
  risk_badge?: string;
  risk_reasons?: string[];
  risk_flags?: any;
  card_hash?: string | null;
  status: string;
};

type Stats = {
  totalUsers: number;
  totalTransactions: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
  payoutProfiles?: number;
  totalApprovedValue: number;
};

export default function App() {
  const [screen, setScreen] = useState<
    | "auth"
    | "home"
    | "submit"
    | "history"
    | "detail"
    | "support"
    | "payoutProfile"
    | "adminHome"
    | "adminQueue"
    | "adminDetail"
  >("auth");

  const [mode, setMode] = useState<"login" | "register" | "admin">("login");

  const [email, setEmail] = useState("test@cardharbor.app");
  const [password, setPassword] = useState("password123");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brand, setBrand] = useState("Amazon");
  const [balance, setBalance] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("Cash App");
  const [imageUri, setImageUri] = useState("");

  const [preferredMethod, setPreferredMethod] = useState("Cash App");
  const [cashappTag, setCashappTag] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [routingLast4, setRoutingLast4] = useState("");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethodUsed, setPayoutMethodUsed] = useState("");
  const [adminFilter, setAdminFilter] = useState("All");
  const [adminSearch, setAdminSearch] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    boot();
  }, []);

  async function boot() {
    await loadBrands();
    await restoreSession();
    await recoverPendingImage();
  }

  async function request(path: string, options: any = {}) {
    const activeToken = token || (await AsyncStorage.getItem("cardharbor_token")) || "";
    const headers: any = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function restoreSession() {
    const savedToken = await AsyncStorage.getItem("cardharbor_token");
    const savedUser = await AsyncStorage.getItem("cardharbor_user");

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      setUser(parsedUser);
      if (parsedUser.role === "admin") setScreen("adminHome");
      else setScreen("home");
    }
  }

  async function saveDraft() {
    await AsyncStorage.setItem("cardharbor_draft", JSON.stringify({ brand, balance, payoutMethod }));
  }

  async function recoverPendingImage() {
    try {
      const fn = (ImagePicker as any).getPendingResultAsync;
      if (!fn) return;
      const result = await fn();
      if (result && !result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
        setScreen("submit");
      }
    } catch {}
  }

  async function loadBrands() {
    try {
      const res = await fetch(`${API_URL}/api/brands`);
      const data = await res.json();
      setBrands(data.brands || []);
    } catch {
      setBrands([
        { name: "Amazon", rate: 0.78 },
        { name: "Walmart", rate: 0.74 },
        { name: "Target", rate: 0.74 },
        { name: "Best Buy", rate: 0.7 },
        { name: "Starbucks", rate: 0.65 },
        { name: "Visa", rate: 0.82 },
        { name: "Mastercard", rate: 0.82 },
        { name: "Other", rate: 0.55 },
      ]);
    }
  }

  async function handleAuth() {
    try {
      const path = mode === "admin" ? "/api/admin/login" : mode === "login" ? "/api/login" : "/api/register";
      const loginEmail = mode === "admin" ? "admin@cardharbor.app" : email;
      const loginPassword = mode === "admin" ? "admin123" : password;

      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Auth failed");

      setToken(data.token);
      setUser(data.user);
      await AsyncStorage.setItem("cardharbor_token", data.token);
      await AsyncStorage.setItem("cardharbor_user", JSON.stringify(data.user));

      if (data.user.role === "admin") {
        await loadAdminStats();
        setScreen("adminHome");
      } else {
        setScreen("home");
      }
    } catch (err: any) {
      Alert.alert("CardHarbor", err.message);
    }
  }

  async function logout() {
    await AsyncStorage.multiRemove(["cardharbor_token", "cardharbor_user", "cardharbor_draft"]);
    setToken("");
    setUser(null);
    setTransactions([]);
    setSelectedTransaction(null);
    setImageUri("");
    setStats(null);
    setScreen("auth");
  }

  async function loadPayoutProfile() {
    try {
      const data = await request("/api/payout-profile");
      const p = data.payout_profile;
      if (p) {
        setPreferredMethod(p.preferred_method || "Cash App");
        setCashappTag(p.cashapp_tag || "");
        setVenmoHandle(p.venmo_handle || "");
        setBankName(p.bank_name || "");
        setAccountLast4(p.account_last4 || "");
        setRoutingLast4(p.routing_last4 || "");
        setPayoutMethod(p.preferred_method || "Cash App");
      }
    } catch (err: any) {
      Alert.alert("Payout Profile", err.message);
    }
  }

  async function savePayoutProfile() {
    try {
      const data = await request("/api/payout-profile", {
        method: "POST",
        body: JSON.stringify({
          preferred_method: preferredMethod,
          cashapp_tag: cashappTag,
          venmo_handle: venmoHandle,
          bank_name: bankName,
          account_last4: accountLast4,
          routing_last4: routingLast4,
        }),
      });

      setPayoutMethod(data.payout_profile.preferred_method || preferredMethod);
      Alert.alert("Saved", "Payout profile saved.");
      setScreen("home");
    } catch (err: any) {
      Alert.alert("Payout Profile", err.message);
    }
  }

  function currentRate() {
    return brands.find(b => b.name === brand)?.rate || 0.55;
  }

  function offerPreview() {
    const amount = Number(balance);
    if (!amount || amount <= 0) return "0.00";
    return (Math.round(amount * currentRate() * 100) / 100).toFixed(2);
  }

  async function pickImage() {
    await saveDraft();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Gallery permission is required.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.35,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setScreen("submit");
    }
  }

  async function takePhoto() {
    await saveDraft();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Camera permission is required.");

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.35,
    });

    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
      setScreen("submit");
    }
  }

  async function uploadImage(transactionId: number) {
    if (!imageUri) return null;
    const activeToken = token || (await AsyncStorage.getItem("cardharbor_token")) || "";
    const imageRes = await fetch(imageUri);
    const blob = await imageRes.blob();

    const res = await fetch(`${API_URL}/api/transactions/${transactionId}/image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "image/jpeg",
      },
      body: blob,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Image upload failed");
    return data.transaction;
  }

  async function submitCard() {
    try {
      const amount = Number(balance);
      if (!brand || !amount || amount <= 0) return Alert.alert("CardHarbor", "Enter a valid card balance.");

      const data = await request("/api/transactions", {
        method: "POST",
        body: JSON.stringify({ brand, balance: amount, payout_method: payoutMethod }),
      });

      let finalTransaction = data.transaction;
      if (imageUri) finalTransaction = await uploadImage(data.transaction.id);

      await AsyncStorage.removeItem("cardharbor_draft");
      setBalance("");
      setImageUri("");
      setSelectedTransaction(finalTransaction);
      await loadHistory();
      setScreen("detail");
    } catch (err: any) {
      Alert.alert("CardHarbor", err.message);
    }
  }

  async function loadHistory() {
    try {
      const data = await request("/api/transactions");
      setTransactions(data.transactions || []);
    } catch (err: any) {
      Alert.alert("CardHarbor", err.message);
    }
  }

  async function loadAnalytics() {
    try {
      const data = await request("/api/admin/analytics");
      setAnalytics(data);
    } catch (err: any) {
      Alert.alert("Analytics", err.message);
    }
  }

  async function loadAdminStats() {
    try {
      const data = await request("/api/admin/stats");
      setStats(data.stats);
    } catch (err: any) {
      Alert.alert("Admin", err.message);
    }
  }

  async function loadAdminQueue() {
    try {
      const data = await request("/api/admin/transactions");
      setTransactions(data.transactions || []);
      setScreen("adminQueue");
    } catch (err: any) {
      Alert.alert("Admin", err.message);
    }
  }

  async function updateStatus(status: string) {
    if (!selectedTransaction) return;
    try {
      const data = await request(`/api/admin/transactions/${selectedTransaction.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, admin_note: adminNote, payout_note: payoutNote, payout_reference: payoutReference }),
      });
      setSelectedTransaction(data.transaction);
      await loadAdminStats();
      Alert.alert("Updated", `Status changed to ${status}`);
    } catch (err: any) {
      Alert.alert("Admin", err.message);
    }
  }

  if (screen === "auth") {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>CardHarbor</Text>
          <Text style={styles.subtitle}>Gift card cashout platform</Text>

          <View style={styles.card}>
            <Text style={styles.title}>{mode === "admin" ? "Admin Login" : mode === "login" ? "Login" : "Register"}</Text>

            {mode !== "admin" && (
              <>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
                <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
              </>
            )}

            {mode === "admin" && (
              <View style={styles.noticeBox}>
                <Text style={styles.body}>MVP admin uses saved test credentials.</Text>
                <Text style={styles.mono}>admin@cardharbor.app</Text>
                <Text style={styles.mono}>admin123</Text>
              </View>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuth}>
              <Text style={styles.primaryButtonText}>{mode === "admin" ? "Enter Admin Dashboard" : mode === "login" ? "Login" : "Register"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode(mode === "login" ? "register" : "login")}>
              <Text style={styles.secondaryButtonText}>{mode === "login" ? "Create account" : "Back to login"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMode(mode === "admin" ? "login" : "admin")}>
              <Text style={styles.secondaryButtonText}>{mode === "admin" ? "User Login" : "Admin Mode"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>CardHarbor</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>

        {screen === "home" && (
          <View style={styles.card}>
            <Text style={styles.title}>Dashboard</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setScreen("submit")}>
              <Text style={styles.primaryButtonText}>Submit Gift Card</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={async () => { await loadHistory(); setScreen("history"); }}>
              <Text style={styles.primaryButtonText}>Transaction History</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={async () => { await loadPayoutProfile(); setScreen("payoutProfile"); }}>
              <Text style={styles.secondaryButtonText}>Payout Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("support")}>
              <Text style={styles.secondaryButtonText}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={logout}>
              <Text style={styles.dangerButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "payoutProfile" && (
          <View style={styles.card}>
            <Text style={styles.title}>Payout Profile</Text>

            <Text style={styles.label}>Preferred Method</Text>
            <View style={styles.brandGrid}>
              {["Cash App", "Venmo", "ACH"].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.brandButton, preferredMethod === m && styles.brandSelected]}
                  onPress={() => {
                    setPreferredMethod(m);
                    setPayoutMethod(m);
                  }}
                >
                  <Text style={[styles.brandText, preferredMethod === m && styles.brandTextSelected]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Cash App Tag</Text>
            <TextInput style={styles.input} value={cashappTag} onChangeText={setCashappTag} placeholder="$yourtag" />

            <Text style={styles.label}>Venmo Handle</Text>
            <TextInput style={styles.input} value={venmoHandle} onChangeText={setVenmoHandle} placeholder="@yourvenmo" />

            <Text style={styles.label}>Bank Name</Text>
            <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="ACH placeholder" />

            <Text style={styles.label}>Account Last 4</Text>
            <TextInput style={styles.input} value={accountLast4} onChangeText={setAccountLast4} keyboardType="numeric" maxLength={4} />

            <Text style={styles.label}>Routing Last 4</Text>
            <TextInput style={styles.input} value={routingLast4} onChangeText={setRoutingLast4} keyboardType="numeric" maxLength={4} />

            <TouchableOpacity style={styles.primaryButton} onPress={savePayoutProfile}>
              <Text style={styles.primaryButtonText}>Save Payout Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "submit" && (
          <View style={styles.card}>
            <Text style={styles.title}>Submit Card</Text>

            <Text style={styles.label}>Choose Brand</Text>
            <View style={styles.brandGrid}>
              {brands.map(item => (
                <TouchableOpacity key={item.name} style={[styles.brandButton, brand === item.name && styles.brandSelected]} onPress={() => setBrand(item.name)}>
                  <Text style={[styles.brandText, brand === item.name && styles.brandTextSelected]}>{item.name}</Text>
                  <Text style={[styles.brandRate, brand === item.name && styles.brandTextSelected]}>{Math.round(item.rate * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Balance</Text>
            <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="numeric" placeholder="100" />

            <Text style={styles.label}>Payout Method</Text>
            <TextInput style={styles.input} value={payoutMethod} onChangeText={setPayoutMethod} />

            <Text style={styles.label}>Gift Card Image</Text>

            <TouchableOpacity style={styles.secondaryButton} onPress={takePhoto}>
              <Text style={styles.secondaryButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
              <Text style={styles.secondaryButtonText}>Choose From Gallery</Text>
            </TouchableOpacity>

            {imageUri ? (
              <View style={styles.previewBox}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.dangerButton} onPress={() => setImageUri("")}>
                  <Text style={styles.dangerButtonText}>Remove Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.body}>No image selected. Image is optional for MVP testing.</Text>
            )}

            <View style={styles.offerBox}>
              <Text style={styles.offerLabel}>Estimated Offer</Text>
              <Text style={styles.offer}>${offerPreview()}</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={submitCard}>
              <Text style={styles.primaryButtonText}>Submit for Review</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "history" && (
          <TransactionList title="History" items={transactions} onOpen={(i) => { setSelectedTransaction(i); setScreen("detail"); }} onRefresh={loadHistory} onBack={() => setScreen("home")} />
        )}

        {screen === "detail" && selectedTransaction && (
          <TransactionDetail item={selectedTransaction} admin={false} onBack={async () => { await loadHistory(); setScreen("history"); }} onHome={() => setScreen("home")} />
        )}

        {screen === "adminHome" && (
          <View style={styles.card}>
            <Text style={styles.title}>Admin Dashboard</Text>

            <TouchableOpacity style={styles.primaryButton} onPress={loadAdminStats}>
              <Text style={styles.primaryButtonText}>Refresh Stats</Text>
            </TouchableOpacity>

            {stats && (
              <View>
                <Stat label="Users" value={stats.totalUsers} />
                <Stat label="Transactions" value={stats.totalTransactions} />
                <Stat label="Pending" value={stats.pending} />
                <Stat label="Approved" value={stats.approved} />
                <Stat label="Rejected" value={stats.rejected} />
                <Stat label="Paid" value={stats.paid} />
                <Stat label="Payout Profiles" value={stats.payoutProfiles || 0} />
                <Stat label="Approved Value" value={`$${stats.totalApprovedValue}`} />
              </View>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={loadAdminQueue}>
              <Text style={styles.primaryButtonText}>Review Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dangerButton} onPress={logout}>
              <Text style={styles.dangerButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "adminQueue" && (
          <View>
            <View style={styles.card}>
              <Text style={styles.title}>Queue Filter</Text>

              <TextInput
                style={styles.input}
                value={adminSearch}
                onChangeText={setAdminSearch}
                placeholder="Search ID, email, brand, status, ref"
              />

              {["All", "Pending", "Ready For Payout", "Paid", "Rejected"].map((f) => (
                <TouchableOpacity key={f} style={adminFilter === f ? styles.primaryButton : styles.secondaryButton} onPress={() => setAdminFilter(f)}>
                  <Text style={adminFilter === f ? styles.primaryButtonText : styles.secondaryButtonText}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TransactionList
              title="Admin Review Queue"
              items={transactions.filter(t => {
                const q = adminSearch.trim().toLowerCase();
                const matchesSearch =
                  !q ||
                  String(t.id).toLowerCase().includes(q) ||
                  String(t.user_email || "").toLowerCase().includes(q) ||
                  String(t.brand || "").toLowerCase().includes(q) ||
                  String(t.status || "").toLowerCase().includes(q) ||
                  String(t.payout_reference || "").toLowerCase().includes(q);

                const matchesFilter =
                  adminFilter === "All" ||
                  (adminFilter === "Pending" && (t.status === "Pending Review" || t.status === "Submitted")) ||
                  t.status === adminFilter;

                return matchesSearch && matchesFilter;
              }).sort((a, b) => Number(b.id) - Number(a.id))}
              onOpen={(i) => { setSelectedTransaction(i); setAdminNote(i.admin_note || ""); setPayoutNote(i.payout_note || ""); setPayoutReference(i.payout_reference || ""); setPayoutAmount(String(i.payout_amount || i.offer || "")); setPayoutMethodUsed(i.payout_method_used || i.payout_method || ""); setScreen("adminDetail"); }}
              onRefresh={loadAdminQueue}
              onBack={() => setScreen("adminHome")}
            />
          </View>
        )}

        {screen === "adminDetail" && selectedTransaction && (
          <View>
            <TransactionDetail item={selectedTransaction} admin={true} onBack={loadAdminQueue} onHome={() => setScreen("adminHome")} />

            <View style={styles.card}>
              <Text style={styles.title}>Admin Actions</Text>

              <View style={styles.noticeBox}>
                <Text style={styles.sectionTitle}>Payout Snapshot</Text>
                <Text style={styles.body}>Offer: ${selectedTransaction.offer}</Text>
                <Text style={styles.body}>Saved Amount: {selectedTransaction.payout_amount ? "$" + selectedTransaction.payout_amount : "Not paid yet"}</Text>
                <Text style={styles.body}>Method: {selectedTransaction.payout_method_used || selectedTransaction.payout_method || "Not selected"}</Text>
                <Text style={styles.body}>Reference: {selectedTransaction.payout_reference || "None yet"}</Text>
                <Text style={styles.body}>Paid At: {selectedTransaction.paid_at || "Not paid yet"}</Text>
              </View>

              <Text style={styles.label}>Admin Note</Text>
              <TextInput style={styles.input} value={adminNote} onChangeText={setAdminNote} placeholder="Review reason or internal note" />

              <Text style={styles.label}>Payout Reference</Text>
              <TextInput style={styles.input} value={payoutReference} onChangeText={setPayoutReference} placeholder="Cash App/Venmo/ACH confirmation ID" />

              <Text style={styles.label}>Payout Amount</Text>
              <TextInput style={styles.input} value={payoutAmount} onChangeText={setPayoutAmount} placeholder="Amount actually paid" keyboardType="numeric" />

              <Text style={styles.label}>Payout Method Used</Text>
              <TextInput style={styles.input} value={payoutMethodUsed} onChangeText={setPayoutMethodUsed} placeholder="Cash App / Venmo / ACH / Other" />

              <Text style={styles.label}>Payout Note</Text>
              <TextInput style={styles.input} value={payoutNote} onChangeText={setPayoutNote} placeholder="Payout note visible to user" />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  try {
                    const res = await fetch(`${API_URL}/api/admin/transactions/${selectedTransaction.id}/notes`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${adminToken}`,
                      },
                      body: JSON.stringify({
                        admin_note: adminNote,
                        payout_note: payoutNote,
                        payout_reference: payoutReference,
                        payout_amount: payoutAmount,
                        payout_method_used: payoutMethodUsed,
                      }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                      alert(data.error || "Failed to save admin fields");
                      return;
                    }

                    setSelectedTransaction(data.transaction);
                    alert("Admin fields saved");
                  } catch (err) {
                    alert("Network error saving admin fields");
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Save Admin Fields</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={() => updateStatus("Approved")}>
                <Text style={styles.primaryButtonText}>Approve</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={() => updateStatus("Ready For Payout")}>
                <Text style={styles.primaryButtonText}>Ready For Payout</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={async () => {
                  if (!selectedTransaction) return;

                  try {
                    const res = await fetch(`${API_URL}/api/admin/transactions/${selectedTransaction.id}/status`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${adminToken}`,
                      },
                      body: JSON.stringify({
                        status: "Paid",
                        admin_note: adminNote,
                        payout_note: payoutNote || "Manual payout marked complete.",
                        payout_reference: payoutReference,
                        payout_amount: payoutAmount || selectedTransaction.offer,
                        payout_method_used: payoutMethodUsed || selectedTransaction.payout_method || "Manual",
                      }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                      alert(data.error || "Failed to mark paid");
                      return;
                    }

                    setSelectedTransaction(data.transaction);
                    alert("Marked paid and payout receipt saved");
                    await loadAdminQueue();
                  } catch (err) {
                    alert("Network error marking paid");
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Mark Paid</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => updateStatus("Needs More Info")}>
                <Text style={styles.secondaryButtonText}>Needs More Info</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dangerButton} onPress={() => updateStatus("Rejected")}>
                <Text style={styles.dangerButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {screen === "adminAnalytics" && analytics && (
          <View style={styles.card}>
            <Text style={styles.title}>Analytics Dashboard</Text>

            {analytics.risk?.highRisk > 0 ? (
              <View style={styles.noticeBox}>
                <Text style={styles.sectionTitle}>Alert</Text>
                <Text style={styles.body}>High-risk transactions need review before payout.</Text>
              </View>
            ) : analytics.statuses?.readyForPayout > 0 ? (
              <View style={styles.noticeBox}>
                <Text style={styles.sectionTitle}>Alert</Text>
                <Text style={styles.body}>Transactions are ready for payout.</Text>
              </View>
            ) : analytics.statuses?.pendingReview > 0 ? (
              <View style={styles.noticeBox}>
                <Text style={styles.sectionTitle}>Alert</Text>
                <Text style={styles.body}>Pending transactions need review.</Text>
              </View>
            ) : null}

            <View style={styles.noticeBox}>
              <Text style={styles.sectionTitle}>Snapshot</Text>
              <Text style={styles.body}>Transactions: {analytics.totalTransactions}</Text>
              <Text style={styles.body}>Total Offers: {money(analytics.money?.totalOffers)}</Text>
              <Text style={styles.body}>Total Paid: {money(analytics.money?.totalPaid)}</Text>
              <Text style={styles.body}>High Risk: {analytics.risk?.highRisk}</Text>
            </View>

            <Text style={styles.sectionTitle}>Volume</Text>
            <Text style={styles.body}>Total Transactions: {analytics.totalTransactions}</Text>
            <Text style={styles.body}>Submitted: {analytics.statuses?.submitted}</Text>
            <Text style={styles.body}>Pending Review: {analytics.statuses?.pendingReview}</Text>
            <Text style={styles.body}>Approved: {analytics.statuses?.approved}</Text>
            <Text style={styles.body}>Ready For Payout: {analytics.statuses?.readyForPayout}</Text>
            <Text style={styles.body}>Paid: {analytics.statuses?.paid}</Text>
            <Text style={styles.body}>Rejected: {analytics.statuses?.rejected}</Text>

            <Text style={styles.sectionTitle}>Money</Text>
            <Text style={styles.body}>Total Balance: {money(analytics.money?.totalBalance)}</Text>
            <Text style={styles.body}>Total Offers: {money(analytics.money?.totalOffers)}</Text>
            <Text style={styles.body}>Total Paid: {money(analytics.money?.totalPaid)}</Text>
            <Text style={styles.body}>Unpaid Offers: {money(analytics.money?.unpaidOffers)}</Text>

            <Text style={styles.sectionTitle}>Rates</Text>
            <Text style={styles.body}>Approval Rate: {analytics.rates?.approvalRate}%</Text>
            <Text style={styles.body}>Rejection Rate: {analytics.rates?.rejectionRate}%</Text>
            <Text style={styles.body}>Payout Completion: {analytics.rates?.payoutCompletionRate}%</Text>

            <Text style={styles.sectionTitle}>Risk</Text>
            <Text style={styles.body}>Low Risk: {analytics.risk?.lowRisk}</Text>
            <Text style={styles.body}>Medium Risk: {analytics.risk?.mediumRisk}</Text>
            <Text style={styles.body}>High Risk: {analytics.risk?.highRisk}</Text>

            <Text style={styles.sectionTitle}>Brand Totals</Text>
            {analytics.brandTotals ? Object.entries(analytics.brandTotals).map(([brand, data]: any) => (
              <View key={brand} style={styles.noticeBox}>
                <Text style={styles.body}>{brand}</Text>
                <Text style={styles.body}>Count: {data.count}</Text>
                <Text style={styles.body}>Balance: {money(data.balance)}</Text>
                <Text style={styles.body}>Offers: {money(data.offer)}</Text>
              </View>
            )) : null}

            <View style={styles.noticeBox}>
              <Text style={styles.sectionTitle}>Recommended Actions</Text>
              {analytics.statuses?.readyForPayout > 0 ? <Text style={styles.body}>• Pay out {analytics.statuses.readyForPayout} ready transaction(s).</Text> : null}
              {analytics.risk?.highRisk > 0 ? <Text style={styles.body}>• Review {analytics.risk.highRisk} high-risk transaction(s) before payout.</Text> : null}
              {analytics.statuses?.pendingReview > 0 ? <Text style={styles.body}>• Review {analytics.statuses.pendingReview} pending transaction(s).</Text> : null}
              {analytics.money?.unpaidOffers > 0 ? <Text style={styles.body}>• Outstanding unpaid offers: {money(analytics.money.unpaidOffers)}.</Text> : null}
              {analytics.totalTransactions === 0 ? <Text style={styles.body}>• No transactions yet. Submit a test card to validate the full flow.</Text> : null}
            </View>

            <View style={styles.noticeBox}>
              <Text style={styles.sectionTitle}>Export Summary</Text>
              <Text style={styles.body}>
                CardHarbor Summary: {analytics.totalTransactions} transactions, {money(analytics.money?.totalOffers)} in offers, {money(analytics.money?.totalPaid)} paid, {analytics.rates?.approvalRate}% approval rate, {analytics.risk?.highRisk} high-risk transactions.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={async () => { await loadAdminQueue(); setScreen("adminQueue"); }}>
              <Text style={styles.primaryButtonText}>Open Review Queue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={loadAnalytics}>
              <Text style={styles.primaryButtonText}>Refresh Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("adminHome")}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "support" && (
          <View style={styles.card}>
            <Text style={styles.title}>Support</Text>
            <Text style={styles.body}>MVP support mode. Save the transaction ID and user email for review.</Text>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setScreen("home")}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function money(v: any) {
  const n = Number(v || 0);
  return "$" + n.toFixed(2);
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}


function StatusTimeline({ status }: { status: string }) {
  const steps = ["Submitted", "Pending Review", "Approved", "Ready For Payout", "Paid"];
  const rejected = status === "Rejected";
  const needsInfo = status === "Needs More Info";

  return (
    <View style={styles.noticeBox}>
      <Text style={styles.sectionTitle}>Status Timeline</Text>

      {rejected ? (
        <Text style={styles.dangerButtonText}>Rejected</Text>
      ) : needsInfo ? (
        <Text style={styles.dangerButtonText}>Needs More Info</Text>
      ) : (
        steps.map((step, index) => {
          const activeIndex = steps.indexOf(status);
          const active = index <= activeIndex;

          return (
            <Text key={step} style={{ fontWeight: active ? "900" : "500", color: active ? "#1565c0" : "#64748b", marginBottom: 4 }}>
              {active ? "✓" : "○"} {step}
            </Text>
          );
        })
      )}
    </View>
  );
}

function riskColor(score?: number) {
  const n = Number(score || 0);
  if (n >= 75) return "#dc2626";
  if (n >= 50) return "#f97316";
  if (n >= 25) return "#ca8a04";
  return "#16a34a";
}

function TransactionList({
  title,
  items,
  onOpen,
  onRefresh,
  onBack,
}: {
  title: string;
  items: Transaction[];
  onOpen: (item: Transaction) => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      {items.length === 0 ? (
        <Text style={styles.body}>No transactions yet.</Text>
      ) : (
        items.map((item) => {
          const score = Number(item.risk_score || 0);
          const badge = item.risk_badge || "Low Risk";
          const reasons = item.risk_reasons || [];

          return (
            <TouchableOpacity key={String(item.id)} style={styles.historyItem} onPress={() => onOpen(item)}>
              <Text style={styles.historyTitle}>{item.brand} / {item.detected_brand || "Unknown"}</Text>
              <Text style={{ fontWeight: "800" }}>Status: {item.status}</Text>
              <Text>Balance: ${item.balance}</Text>
              <Text>Offer: ${item.offer}</Text>
              {item.payout_amount ? <Text>Payout Amount: ${item.payout_amount}</Text> : null}
              {item.payout_method_used ? <Text>Paid Via: {item.payout_method_used}</Text> : null}
              {item.payout_reference ? <Text>Ref: {item.payout_reference}</Text> : null}
              <Text>Image: {item.image_url ? "yes" : "none"}</Text>

              <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: riskColor(score) }}>
                <Text style={{ fontWeight: "800", color: riskColor(score) }}>
                  Risk Score: {score}/100
                </Text>
                <Text style={{ fontWeight: "700", color: riskColor(score), marginTop: 2 }}>
                  {badge}
                </Text>

                {reasons.length > 0 ? (
                  <View style={{ marginTop: 6 }}>
                    {reasons.map((reason, index) => (
                      <Text key={index} style={{ fontSize: 12, color: "#334155" }}>• {reason}</Text>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>No risk warnings.</Text>
                )}
              </View>

              <Text style={styles.tapHint}>Tap for details</Text>

              {item.status !== "Approved" && item.status !== "Paid" ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={async () => {
                    try {
                      const token = await AsyncStorage.getItem("cardharbor_token");

                      await fetch(`${API_URL}/api/admin/transactions/${item.id}/status`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          status: "Approved"
                        }),
                      });

                      onRefresh();
                    } catch (err) {
                      console.log(err);
                    }
                  }}
                >
                  <Text style={styles.primaryButtonText}>Quick Approve</Text>
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={onRefresh}>
        <Text style={styles.primaryButtonText}>Refresh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function TransactionDetail({ item, admin, onBack, onHome }: { item: Transaction; admin: boolean; onBack: () => void; onHome: () => void }) {
  async function updateStatus(status: string) {
    try {
      const activeToken = await AsyncStorage.getItem("cardharbor_token");
      const res = await fetch(`${API_URL}/api/admin/transactions/${item.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          status,
          admin_note: "",
          payout_note: status === "Paid" ? "Manual payout marked complete." : "",
          payout_reference: "",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status update failed");

      Alert.alert("Updated", `Transaction marked: ${status}`);
      onBack();
    } catch (err: any) {
      Alert.alert("Admin Action Failed", err.message);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{admin ? "Admin Review Detail" : "Transaction Detail"}</Text>

      {item.image_url ? (
        <Image source={{ uri: `${API_URL}${item.image_url}` }} style={styles.previewImage} />
      ) : (
        <Text style={styles.body}>No image uploaded for this transaction.</Text>
      )}

      <View style={styles.detailRow}><Text style={styles.detailKey}>ID</Text><Text>{item.id}</Text></View>
      {item.user_email ? <View style={styles.detailRow}><Text style={styles.detailKey}>User</Text><Text>{item.user_email}</Text></View> : null}
      <View style={styles.detailRow}><Text style={styles.detailKey}>Selected Brand</Text><Text>{item.brand}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>OCR Brand</Text><Text>{item.detected_brand || "Not detected"}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>Balance</Text><Text>${item.balance}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>OCR Balance</Text><Text>{item.detected_balance ? `$${item.detected_balance}` : "Not detected"}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>Offer</Text><Text>${item.offer}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>Payout</Text><Text>{item.payout_method}</Text></View>
      <View style={styles.detailRow}><Text style={styles.detailKey}>Status</Text><Text>{item.status}</Text></View>

      <StatusTimeline status={item.status} />

      {item.risk_score !== undefined ? (
        <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: riskColor(item.risk_score) }}>
          <Text style={{ fontWeight: "800", color: riskColor(item.risk_score) }}>
            Risk Score: {item.risk_score}/100
          </Text>
          <Text style={{ fontWeight: "700", color: riskColor(item.risk_score), marginTop: 2 }}>
            {item.risk_badge || "Low Risk"}
          </Text>
          {item.risk_reasons && item.risk_reasons.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              {item.risk_reasons.map((reason, index) => (
                <Text key={index} style={{ fontSize: 12, color: "#334155" }}>• {reason}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {item.admin_note ? <View style={styles.detailRow}><Text style={styles.detailKey}>Admin Note</Text><Text>{item.admin_note}</Text></View> : null}
      {item.payout_amount ? <View style={styles.detailRow}><Text style={styles.detailKey}>Payout Amount</Text><Text>${item.payout_amount}</Text></View> : null}
      {item.payout_method_used ? <View style={styles.detailRow}><Text style={styles.detailKey}>Method Used</Text><Text>{item.payout_method_used}</Text></View> : null}
      {item.payout_reference ? <View style={styles.detailRow}><Text style={styles.detailKey}>Payout Ref</Text><Text>{item.payout_reference}</Text></View> : null}
      {item.payout_note ? <View style={styles.detailRow}><Text style={styles.detailKey}>Payout Note</Text><Text>{item.payout_note}</Text></View> : null}
      {item.paid_by ? <View style={styles.detailRow}><Text style={styles.detailKey}>Paid By</Text><Text>{item.paid_by}</Text></View> : null}
      {item.paid_at ? <View style={styles.detailRow}><Text style={styles.detailKey}>Paid At</Text><Text>{item.paid_at}</Text></View> : null}

      <Text style={styles.sectionTitle}>Possible Codes</Text>
      {item.possible_codes && item.possible_codes.length > 0 ? (
        item.possible_codes.map((code, index) => <Text key={index} style={styles.codeBox}>{code}</Text>)
      ) : (
        <Text style={styles.body}>No possible codes detected.</Text>
      )}

      <Text style={styles.sectionTitle}>OCR Text</Text>
      <Text style={styles.ocrBox}>
        {item.ocr_text && item.ocr_text.length > 0 ? item.ocr_text : item.ocr_error || "No OCR text available."}
      </Text>

      <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={onHome}>
        <Text style={styles.primaryButtonText}>Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef3f8" },
  container: { padding: 20, paddingBottom: 60 },
  logo: { fontSize: 36, fontWeight: "900", textAlign: "center", marginTop: 20, color: "#12324a" },
  subtitle: { textAlign: "center", color: "#526675", marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: "white", borderRadius: 22, padding: 18, elevation: 3, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 12, color: "#12324a" },
  body: { fontSize: 16, color: "#475866", lineHeight: 22, marginVertical: 8 },
  mono: { fontFamily: "monospace", color: "#12324a", fontWeight: "800", marginTop: 4 },
  label: { fontWeight: "700", marginBottom: 6, color: "#12324a" },
  input: { borderWidth: 1, borderColor: "#ccd7e0", borderRadius: 14, padding: 14, marginBottom: 12, backgroundColor: "#f8fbfd" },
  primaryButton: { backgroundColor: "#1565c0", padding: 15, borderRadius: 14, marginTop: 10 },
  primaryButtonText: { color: "white", textAlign: "center", fontWeight: "800", fontSize: 16 },
  secondaryButton: { backgroundColor: "#e8eef5", padding: 15, borderRadius: 14, marginTop: 10 },
  secondaryButtonText: { color: "#12324a", textAlign: "center", fontWeight: "800", fontSize: 16 },
  dangerButton: { backgroundColor: "#ffe5e5", padding: 15, borderRadius: 14, marginTop: 10 },
  dangerButtonText: { color: "#9b1c1c", textAlign: "center", fontWeight: "800", fontSize: 16 },
  brandGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  brandButton: { width: "48%", borderWidth: 1, borderColor: "#ccd7e0", borderRadius: 14, padding: 12, backgroundColor: "#f8fbfd" },
  brandSelected: { backgroundColor: "#1565c0", borderColor: "#1565c0" },
  brandText: { fontWeight: "900", color: "#12324a" },
  brandRate: { color: "#526675", marginTop: 4 },
  brandTextSelected: { color: "white" },
  offerBox: { backgroundColor: "#eef6ff", borderRadius: 16, padding: 14, marginVertical: 10 },
  offerLabel: { color: "#526675", fontWeight: "700" },
  offer: { fontSize: 28, fontWeight: "900", color: "#12324a", marginTop: 4 },
  statBox: { backgroundColor: "#f4f8fb", padding: 14, borderRadius: 14, marginBottom: 10 },
  statLabel: { color: "#526675", fontWeight: "700" },
  statValue: { color: "#12324a", fontWeight: "900", fontSize: 18, marginTop: 4 },
  historyItem: { backgroundColor: "#f4f8fb", padding: 14, borderRadius: 14, marginBottom: 10 },
  historyTitle: { fontWeight: "900", fontSize: 18, color: "#12324a", marginBottom: 4 },
  tapHint: { marginTop: 6, color: "#1565c0", fontWeight: "700" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e8eef5", paddingVertical: 10, gap: 10 },
  detailKey: { fontWeight: "900", color: "#12324a" },
  previewBox: { marginTop: 10 },
  previewImage: { width: "100%", height: 230, borderRadius: 16, backgroundColor: "#d9e3ec", marginVertical: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#12324a", marginTop: 16, marginBottom: 8 },
  codeBox: { backgroundColor: "#eef6ff", color: "#12324a", fontWeight: "800", padding: 10, borderRadius: 10, marginBottom: 6 },
  ocrBox: { backgroundColor: "#f4f8fb", color: "#263845", padding: 12, borderRadius: 12, lineHeight: 20 },
  noticeBox: { backgroundColor: "#fff8e1", padding: 12, borderRadius: 12, marginBottom: 10 },
});
