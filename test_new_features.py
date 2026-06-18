import os
import time
from playwright.sync_api import sync_playwright

def run_new_features_test():
    extension_path = os.path.abspath(os.path.dirname(__file__))
    profile_dir = os.path.abspath("playwright_profile_new_features")
    os.makedirs("test_artifacts", exist_ok=True)
    
    print("Launching Chromium for New Features Test...")
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
            # 1. Open mock dashboard
            dashboard_page = context.pages[0]
            dashboard_page.goto("http://localhost:8080/mock_dashboard.html")
            time.sleep(2)
            
            original_title = dashboard_page.title()
            print(f"Original Dashboard Title: '{original_title}'")
            
            # Get extension ID
            service_workers = context.service_workers
            if not service_workers:
                time.sleep(2)
                service_workers = context.service_workers
            sw_url = service_workers[0].url
            extension_id = sw_url.split("/")[2]
            
            # 2. Open Popup page
            popup_page = context.new_page()
            popup_page.goto(f"chrome-extension://{extension_id}/popup.html")
            time.sleep(1.5)
            
            # 3. Test Tab Cloaking Toggle ON
            print("\nToggling Tab Cloaking ON...")
            popup_page.evaluate("document.getElementById('btn-toggle-cloaking').click()")
            time.sleep(1) # wait for sync
            
            dashboard_page.bring_to_front()
            time.sleep(0.5)
            cloaked_title = dashboard_page.title()
            print(f"Title after cloaking: '{cloaked_title}'")
            assert cloaked_title == "Hidden tab", f"Title should be 'Hidden tab', got '{cloaked_title}'"
            print("SUCCESS: Tab title cloaked successfully.")
            
            # Check favicon
            favicon_href = dashboard_page.evaluate("""
                () => {
                    const link = document.querySelector("link[rel*='icon']");
                    return link ? link.getAttribute('href') : null;
                }
            """)
            print(f"Favicon href after cloaking: {favicon_href[:60]}...")
            assert favicon_href and favicon_href.startswith("data:image/svg+xml"), "Favicon should be our shield SVG"
            print("SUCCESS: Favicon cloaked successfully.")
            
            # 4. Test Tab Cloaking Toggle OFF
            popup_page.bring_to_front()
            popup_page.evaluate("document.getElementById('btn-toggle-cloaking').click()")
            time.sleep(1)
            
            dashboard_page.bring_to_front()
            time.sleep(0.5)
            restored_title = dashboard_page.title()
            print(f"Title after disabling cloaking: '{restored_title}'")
            assert restored_title == original_title, f"Title should be restored to '{original_title}', got '{restored_title}'"
            print("SUCCESS: Tab title restored successfully.")
            
            # 5. Test Selector Naming and Enable/Disable Toggles
            print("\nTesting Custom Selectors Names and Toggles...")
            popup_page.bring_to_front()
            popup_page.click("button[data-target='tab-selectors']") # Go to selectors tab
            time.sleep(0.5)
            
            # We want to add a selector by dialog
            # Set up dialog handler for prompt in playwright
            # When prompt opens, we accept it with label "Total Rec Card"
            def handle_dialog(dialog):
                print(f"Dialog encountered: message='{dialog.message}', default='{dialog.default_value}'")
                dialog.accept("Total Rec Card")
            
            popup_page.on("dialog", handle_dialog)
            
            popup_page.fill("#input-new-selector", '[data-testid="text-total-received"]')
            popup_page.click("#btn-add-selector")
            time.sleep(1)
            
            # Check if selector card is rendered with name "Total Rec Card"
            selector_item_text = popup_page.locator(".selector-name").first.text_content()
            print(f"Added Selector name shown: '{selector_item_text}'")
            assert selector_item_text == "Total Rec Card", f"Expected 'Total Rec Card', got '{selector_item_text}'"
            print("SUCCESS: Selector label prompted and saved successfully.")
            
            # Check if element is blurred on dashboard
            dashboard_page.bring_to_front()
            time.sleep(0.5)
            target_element = dashboard_page.locator('[data-testid="text-total-received"]')
            is_blurred = target_element.evaluate("el => getComputedStyle(el).filter.includes('blur')")
            print(f"Is target element blurred on dashboard? {is_blurred}")
            assert is_blurred, "Target element should be blurred"
            
            # 6. Toggle Selector OFF in Popup
            popup_page.bring_to_front()
            # Click the checkbox inside the first selector-item
            popup_page.evaluate("document.querySelector('.selector-item input[type=\\'checkbox\\']').click()")
            time.sleep(1)
            
            # Check dashboard element is now unblurred
            dashboard_page.bring_to_front()
            time.sleep(0.5)
            is_blurred_after_disable = target_element.evaluate("el => getComputedStyle(el).filter.includes('blur')")
            print(f"Is target element blurred after disabling selector? {is_blurred_after_disable}")
            assert not is_blurred_after_disable, "Target element should be unblurred"
            print("SUCCESS: Individual selector toggle disabled successfully.")
            
            # 7. Edit Label Reference name
            popup_page.bring_to_front()
            # Update dialog handler to rename selector
            popup_page.remove_listener("dialog", handle_dialog)
            def handle_rename_dialog(dialog):
                print(f"Rename Dialog: message='{dialog.message}'")
                dialog.accept("Renamed Balance Card")
            popup_page.on("dialog", handle_rename_dialog)
            
            popup_page.click(".btn-edit-label")
            time.sleep(1)
            
            renamed_label = popup_page.locator(".selector-name").first.text_content()
            print(f"Renamed selector label shown: '{renamed_label}'")
            assert renamed_label == "Renamed Balance Card", f"Expected 'Renamed Balance Card', got '{renamed_label}'"
            print("SUCCESS: Selector label renamed inline successfully.")
            
            popup_page.screenshot(path="test_artifacts/12_new_features_popup_completed.png")
            print("Captured screenshot: test_artifacts/12_new_features_popup_completed.png")
            
            print("\nAll new features tested and verified successfully!")
            
        finally:
            context.close()

if __name__ == "__main__":
    run_new_features_test()
