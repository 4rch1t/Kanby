(function(){
	"use strict";

	// Configure these with your Supabase project details
	const SUPABASE_URL = window.SUPABASE_URL || ""; // e.g. https://xyzcompany.supabase.co
	const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ""; // anon key

	/** @type {import("@supabase/supabase-js").SupabaseClient} */
	let supabase;

	function initClient(){
		if (!window.supabase) { console.error("Supabase script not loaded"); return; }
		if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
			console.warn("Supabase URL/Anon key not set. Define window.SUPABASE_URL and window.SUPABASE_ANON_KEY before this script or edit auth.js.");
		}
		supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
	}

	async function signInWithEmail(email, password){
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;
		return data;
	}

	async function signUpWithEmail(email, password){
		const { data, error } = await supabase.auth.signUp({ email, password });
		if (error) throw error;
		return data;
	}

	async function signInWithGoogle(){
		const redirectTo = new URL("index.html", location.href).toString();
		const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
		if (error) throw error;
		return data;
	}

	async function signOut(){ await supabase.auth.signOut(); }

	function toast(msg){ alert(msg); }

	function bindAuthPage(){
		const form = document.getElementById("authForm");
		const emailEl = document.getElementById("authEmail");
		const passEl = document.getElementById("authPassword");
		const signinBtn = document.getElementById("signinBtn");
		const signupBtn = document.getElementById("signupBtn");
		const googleBtn = document.getElementById("googleSigninBtn");
		if (!form) return; // not on login page

		form.addEventListener("submit", async (e) => {
			e.preventDefault();
			const email = emailEl.value.trim();
			const pass = passEl.value;
			if (!email || !pass) return;
			signinBtn.disabled = true;
			try {
				await signInWithEmail(email, pass);
				location.href = "index.html";
			} catch (err) {
				toast(err.message || "Sign in failed");
			} finally {
				signinBtn.disabled = false;
			}
		});

		signupBtn.addEventListener("click", async () => {
			const email = emailEl.value.trim();
			const pass = passEl.value;
			if (!email || !pass) { toast("Enter email and password"); return; }
			signupBtn.disabled = true;
			try {
				await signUpWithEmail(email, pass);
				toast("Check your email to confirm your account.");
			} catch (err) { toast(err.message || "Sign up failed"); }
			finally { signupBtn.disabled = false; }
		});

		if (googleBtn) {
			googleBtn.addEventListener("click", async () => {
				googleBtn.disabled = true;
				try { await signInWithGoogle(); } catch (err) { toast(err.message || "Google sign-in failed"); googleBtn.disabled = false; }
			});
		}
	}

	function bindAppGuards(){
		const guardAttr = document.body && document.body.getAttribute("data-require-auth");
		if (!guardAttr) return; // not guarded
		supabase.auth.onAuthStateChange(async (event, session) => {
			if (!session) {
				location.href = "login.html";
			}
		});
		// initial check
		supabase.auth.getSession().then(({ data }) => {
			if (!data.session) location.href = "login.html";
		});
	}

	function bindSignOut(){
		const signoutBtn = document.getElementById("signoutBtn");
		if (!signoutBtn) return;
		signoutBtn.addEventListener("click", async () => { await signOut(); location.href = "login.html"; });
	}

	document.addEventListener("DOMContentLoaded", () => {
		initClient();
		bindAuthPage();
		bindAppGuards();
		bindSignOut();
	});
})();

