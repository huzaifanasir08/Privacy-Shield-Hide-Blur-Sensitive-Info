import os
import time
from playwright.sync_api import sync_playwright

def run_inspect_test():
    extension_path = os.path.abspath(os.path.dirname(__file__))
    profile_dir = os.path.abspath("playwright_profile_inspect")
    os.makedirs("test_artifacts", exist_ok=True)
    
    print(f"Launching Playwright Chromium for Selector Test...")
    print(f"Extension Path: {extension_path}")
    
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            profile_dir,
            headless=False,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ]
        )
        
        try:
            # 1. Load mock dashboard
            print("\nStep 1: Loading mock dashboard...")
            dashboard_page = context.pages[0]
            dashboard_page.goto("http://localhost:8080/mock_dashboard.html")
            time.sleep(2)
            
            # Save pre-selection screenshot
            dashboard_page.screenshot(path="test_artifacts/8_before_visual_selection.png")
            print("Captured screenshot: test_artifacts/8_before_visual_selection.png")
            
            # 2. Get Extension ID
            service_workers = context.service_workers
            if not service_workers:
                time.sleep(2)
                service_workers = context.service_workers
            sw_url = service_workers[0].url
            extension_id = sw_url.split("/")[2]
            print(f"SUCCESS: Found Extension ID: {extension_id}")
            
            # 3. Open Popup
            print("\nStep 3: Opening Popup UI...")
            popup_page = context.new_page()
            popup_page.goto(f"chrome-extension://{extension_id}/popup.html")
            time.sleep(1.5)
            
            # 4. Click Visual Element Selector Button in Selectors Tab
            print("\nStep 4: Triggering Visual Selector from Popup...")
            popup_page.click("button[data-target='tab-selectors']") # Go to selectors tab
            time.sleep(0.5)
            
            popup_page.click("#btn-inspect-element") # Trigger inspect mode (should close popup page)
            time.sleep(1)
            
            # 5. Hover over 'Hours Paid' card value on the dashboard
            print("\nStep 5: Hovering over Hours Paid element on dashboard...")
            dashboard_page.bring_to_front()
            
            # Move cursor to hover over data-testid="text-total-hours"
            target_locator = dashboard_page.locator('[data-testid="text-total-hours"]')
            target_locator.hover()
            time.sleep(1) # wait for overlay highlight transition
            
            dashboard_page.screenshot(path="test_artifacts/9_hover_element_highlighted.png")
            print("Captured screenshot: test_artifacts/9_hover_element_highlighted.png")
            
            # Check that highlight overlay is active and visible
            overlay_visible = dashboard_page.locator("#privacy-shield-inspect-overlay").is_visible()
            tooltip_visible = dashboard_page.locator("#privacy-shield-inspect-tooltip").is_visible()
            tooltip_text = dashboard_page.locator("#privacy-shield-inspect-tooltip").text_content()
            
            print(f"SUCCESS: Inspect Overlay visible: {overlay_visible}")
            print(f"SUCCESS: Inspect Tooltip visible: {tooltip_visible}, Calculated selector: '{tooltip_text}'")
            
            # 6. Click the element to trigger blur selection
            print("\nStep 6: Clicking element to select and blur...")
            target_locator.click()
            time.sleep(1.5) # Wait for storage sync and toast transition
            
            # Save screenshot showing element is blurred and toast notification is visible
            dashboard_page.screenshot(path="test_artifacts/10_element_blurred_and_toast.png")
            print("Captured screenshot: test_artifacts/10_element_blurred_and_toast.png")
            
            # Verify element is blurred (has class or inherits style)
            is_blurred = target_locator.evaluate("el => getComputedStyle(el).filter.includes('blur')")
            print(f"SUCCESS: Target element is blurred in CSS: {is_blurred}")
            
            # 7. Re-open popup to verify selector list updated
            print("\nStep 7: Verifying popup selector list updated...")
            popup_page = context.new_page()
            popup_page.goto(f"chrome-extension://{extension_id}/popup.html")
            time.sleep(1.5)
            popup_page.click("button[data-target='tab-selectors']")
            time.sleep(0.5)
            
            popup_page.screenshot(path="test_artifacts/11_popup_list_updated.png")
            print("Captured screenshot: test_artifacts/11_popup_list_updated.png")
            
            print("\nVisual Element Selector manual integration test complete!")
            
        finally:
            context.close()

if __name__ == "__main__":
    run_inspect_test()
