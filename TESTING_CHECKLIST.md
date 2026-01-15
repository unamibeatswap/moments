# ✅ PHASE 1 - QUICK TESTING CHECKLIST

**Time Required**: 15 minutes  
**Browser**: Chrome/Firefox (with DevTools open - F12)

---

## 🧪 TEST 1: Campaign Activation (5 min)

### Steps:
1. Go to admin dashboard: `https://moments.unamifoundation.org/admin-dashboard.html`
2. Click "Campaigns" tab
3. Click "+ New Campaign" button
4. Fill in:
   - Title: "Test Campaign Phase 1"
   - Content: "Testing campaign activation"
   - Budget: 200
   - Primary Region: LP
   - Primary Category: Local Services
5. Click "Create Campaign"

### Expected Results:
- ✅ Campaign created successfully
- ✅ Status shows "active" (NOT "pending_review")
- ✅ No CORS errors in console
- ✅ "Activate" button works if clicked

### If Failed:
- Check browser console for errors
- Clear cache and try again
- Check `PHASE1_DEPLOYMENT_VERIFICATION.md` troubleshooting

---

## 💰 TEST 2: Budget Settings (5 min)

### Steps:
1. Click "Budget" tab in admin dashboard
2. Scroll to "Budget Settings" section
3. Change "Template Message Cost (R)" from 0.12 to 0.15
4. Click "Save Budget Settings"
5. Wait for success message
6. Refresh page (F5)
7. Check if value is still 0.15

### Expected Results:
- ✅ Success message appears
- ✅ No errors in console
- ✅ Value persists after refresh
- ✅ Shows R0.15 (not R0.12)

### If Failed:
- Check console for errors
- Verify you're logged in
- Try different value (e.g., 0.20)

---

## 🏢 TEST 3: Sponsor Refresh (5 min)

### Steps:
1. Click "Sponsors" tab
2. Click "+ New Sponsor" button
3. Fill in:
   - Name: test_sponsor_phase1
   - Display Name: Test Sponsor Phase 1
   - Contact Email: test@example.com
4. Click "Create Sponsor"
5. Wait 2 seconds
6. Check if sponsor appears in list
7. Go to "Campaigns" tab
8. Click "+ New Campaign"
9. Check sponsor dropdown

### Expected Results:
- ✅ Sponsor appears in list immediately
- ✅ Sponsor appears in campaign dropdown
- ✅ No manual refresh needed
- ✅ No errors in console

### If Failed:
- Wait 5 seconds and check again
- Manually refresh page (should appear)
- Check console for errors

---

## 📊 RESULTS

**Mark your results:**

- [ ] Test 1: Campaign Activation - PASS / FAIL
- [ ] Test 2: Budget Settings - PASS / FAIL
- [ ] Test 3: Sponsor Refresh - PASS / FAIL

**Console Errors**: YES / NO

---

## ✅ IF ALL TESTS PASS

**Congratulations!** Phase 1 is working correctly.

**Next Steps**:
1. Confirm "All tests passed"
2. Approve Phase 2 start
3. Phase 2 will take 30-45 minutes

---

## ❌ IF ANY TEST FAILS

**Don't panic!** This is why we test.

**Actions**:
1. Note which test failed
2. Copy any console errors
3. Check `PHASE1_DEPLOYMENT_VERIFICATION.md` troubleshooting
4. Report issue with details
5. Rollback available if needed

---

## 🔍 CONSOLE ERRORS TO IGNORE

These are OK (pre-existing):
- "Removing unpermitted intrinsics"
- "Found 2 elements with non-unique id" (will fix in Phase 2)
- Chrome extension errors

These are NOT OK (report immediately):
- CORS errors
- 401/403 errors
- "Failed to fetch"
- JavaScript exceptions

---

**Ready to test? Open admin dashboard and start with Test 1!**
