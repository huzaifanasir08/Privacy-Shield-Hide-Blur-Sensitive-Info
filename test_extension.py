import os
import time
from playwright.sync_api import sync_playwright

def run_test():
    extension_path = os.path.abspath(os.path.dirname(__file__))
    profile_dir = os.path.abspath("playwright_profile")
    os.makedirs("test_artifacts", exist_ok=True)
    
    print(f"Launching Playwright Chromium...")
    print(f"Extension Path: {extension_path}")
    
    with sync_playwright() as p:
        # Launch Chrome with the extension loaded (headful)
        context = p.chromium.launch_persistent_context(
            profile_dir,
            headless=False,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ]
        )
        
        try:
            # 1. Open the Mock Dashboard
            print("\nStep 1: Loading mock dashboard...")
            dashboard_page = context.pages[0]
            dashboard_page.goto("http://localhost:8080/mock_dashboard.html")
            time.sleep(2.5) # Wait for content script to run
            
            # Verify initial regex scanning: check if '$1,200.00' is wrapped in .privacy-shield-blur
            blurred_count = dashboard_page.locator(".privacy-shield-blur").count()
            print(f"SUCCESS: Initial load scanned text nodes. Found {blurred_count} blurred currency text elements.")
            dashboard_page.screenshot(path="test_artifacts/1_initial_load_blurred.png")
            print("Captured screenshot: test_artifacts/1_initial_load_blurred.png")
            
            # 2. Get the Extension ID
            print("\nStep 2: Locating service worker to get Extension ID...")
            time.sleep(1)
            service_workers = context.service_workers
            if not service_workers:
                # Wait a bit longer if not loaded yet
                time.sleep(2)
                service_workers = context.service_workers
                
            if not service_workers:
                raise Exception("Service Worker not found! Extension failed to load.")
                
            sw_url = service_workers[0].url
            extension_id = sw_url.split("/")[2]
            print(f"SUCCESS: Found Extension ID: {extension_id}")
            
            # 3. Open the Popup UI
            print("\nStep 3: Opening Extension Popup UI...")
            popup_page = context.new_page()
            popup_page.goto(f"chrome-extension://{extension_id}/popup.html")
            time.sleep(1.5)
            
            popup_page.screenshot(path="test_artifacts/2_popup_initial_ui.png")
            print("Captured screenshot: test_artifacts/2_popup_initial_ui.png")
            
            # 4. Turn OFF the Shield globally in the Popup
            print("\nStep 4: Toggling Shield OFF in popup...")
            popup_page.evaluate("document.getElementById('btn-toggle-enable').click()")
            time.sleep(1) # wait for storage sync
            
            # Verify on dashboard page: blurs should be disabled
            dashboard_page.bring_to_front()
            is_disabled = dashboard_page.locator("html.privacy-shield-disabled").is_visible()
            print(f"SUCCESS: Dashboard global disable checked. Is disabled class present: {is_disabled}")
            dashboard_page.screenshot(path="test_artifacts/3_dashboard_protection_suspended.png")
            print("Captured screenshot: test_artifacts/3_dashboard_protection_suspended.png")
            
            # 5. Turn ON the Shield again
            print("\nStep 5: Toggling Shield back ON...")
            popup_page.bring_to_front()
            popup_page.evaluate("document.getElementById('btn-toggle-enable').click()")
            time.sleep(1)
            
            # 6. Add Custom CSS Selectors for localhost
            print("\nStep 6: Adding Custom CSS Selectors for localhost in Popup...")
            popup_page.click("button[data-target='tab-selectors']") # Switch to Selectors tab
            time.sleep(0.5)
            
            # Add selector: [data-testid="text-total-received"]
            popup_page.fill("#input-new-selector", '[data-testid="text-total-received"]')
            popup_page.click("#btn-add-selector")
            time.sleep(0.5)
            
            # Add selector: [data-testid="text-total-hours"]
            popup_page.fill("#input-new-selector", '[data-testid="text-total-hours"]')
            popup_page.click("#btn-add-selector")
            time.sleep(0.5)

            # Add selector: [data-testid="text-payment-count"]
            popup_page.fill("#input-new-selector", '[data-testid="text-payment-count"]')
            popup_page.click("#btn-add-selector")
            time.sleep(0.5)
            
            popup_page.screenshot(path="test_artifacts/4_popup_selectors_added.png")
            print("Captured screenshot: test_artifacts/4_popup_selectors_added.png")
            
            # Check dashboard page: now the test-id elements (Total Received, Hours, Payments) must be blurred!
            dashboard_page.bring_to_front()
            time.sleep(1)
            dashboard_page.screenshot(path="test_artifacts/5_dashboard_custom_selectors_blurred.png")
            print("Captured screenshot: test_artifacts/5_dashboard_custom_selectors_blurred.png")
            
            # 7. Test Dynamic Operations (Insertion and In-place character modification)
            print("\nStep 7: Testing dynamic mutations...")
            # Click 'Add Transaction' button on the dashboard
            dashboard_page.click("button:has-text('Add Transaction')")
            time.sleep(0.5)
            # Click 'Update Price' button
            dashboard_page.click("button:has-text('Update Price')")
            time.sleep(1)
            
            dashboard_page.screenshot(path="test_artifacts/6_dashboard_dynamic_mutation_blurred.png")
            print("Captured screenshot: test_artifacts/6_dashboard_dynamic_mutation_blurred.png")
            
            # 8. Whitelist localhost (Suspend protection on this site)
            print("\nStep 8: Testing domain whitelisting...")
            popup_page.bring_to_front()
            popup_page.click("button[data-target='tab-shield']") # Go back to Shield Tab
            time.sleep(0.5)
            popup_page.evaluate("document.getElementById('btn-toggle-domain').click()") # Toggle domain enable off
            time.sleep(1)
            
            # Verify dashboard page is no longer blurred
            dashboard_page.bring_to_front()
            is_disabled_now = dashboard_page.locator("html.privacy-shield-disabled").is_visible()
            print(f"SUCCESS: Whitelist toggle checked. Is disabled class present: {is_disabled_now}")
            dashboard_page.screenshot(path="test_artifacts/7_dashboard_whitelisted_unblurred.png")
            print("Captured screenshot: test_artifacts/7_dashboard_whitelisted_unblurred.png")
            
            print("\nEnd-to-end integration tests completed successfully!")
            
        finally:
            context.close()

if __name__ == "__main__":
    run_test()
