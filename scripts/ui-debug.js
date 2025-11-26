/**
 * UI Debugging Script
 * This script helps identify common UI/UX issues in the RVOIS application
 * 
 * Usage:
 * 1. Run this script in the browser console during development
 * 2. It will highlight potential issues like:
 *    - Elements causing horizontal overflow
 *    - Images without alt text
 *    - Links without href attributes
 *    - Buttons without type attributes
 *    - Form elements without labels
 */

(function() {
  console.log('🔍 RVOIS UI Debug Script - Starting analysis...');
  
  // Check for horizontal overflow
  function checkOverflow() {
    const bodyWidth = document.body.scrollWidth;
    const windowWidth = window.innerWidth;
    
    if (bodyWidth > windowWidth) {
      console.warn(`⚠️  Horizontal overflow detected: Body width (${bodyWidth}px) > Window width (${windowWidth}px)`);
      console.log('💡 Tip: Check for elements with fixed widths that exceed container bounds');
      return true;
    }
    return false;
  }
  
  // Check for images without alt text
  function checkImages() {
    const images = document.querySelectorAll('img');
    const missingAlt = [];
    
    images.forEach(img => {
      if (!img.alt || img.alt.trim() === '') {
        missingAlt.push(img);
      }
    });
    
    if (missingAlt.length > 0) {
      console.warn(`⚠️  ${missingAlt.length} images found without alt text`);
      console.log('💡 Tip: Add descriptive alt text for accessibility');
      return true;
    }
    return false;
  }
  
  // Check for links without href
  function checkLinks() {
    const links = document.querySelectorAll('a');
    const missingHref = [];
    
    links.forEach(link => {
      if (!link.href || link.href.trim() === '') {
        missingHref.push(link);
      }
    });
    
    if (missingHref.length > 0) {
      console.warn(`⚠️  ${missingHref.length} links found without href attributes`);
      console.log('💡 Tip: Add href attributes or use button elements for actions');
      return true;
    }
    return false;
  }
  
  // Check for buttons without type
  function checkButtons() {
    const buttons = document.querySelectorAll('button');
    const missingType = [];
    
    buttons.forEach(button => {
      if (!button.type || button.type.trim() === '') {
        missingType.push(button);
      }
    });
    
    if (missingType.length > 0) {
      console.warn(`⚠️  ${missingType.length} buttons found without type attributes`);
      console.log('💡 Tip: Add type="button" to prevent form submission issues');
      return true;
    }
    return false;
  }
  
  // Check for form elements without labels
  function checkFormLabels() {
    const formElements = document.querySelectorAll('input, textarea, select');
    const missingLabels = [];
    
    formElements.forEach(element => {
      // Skip hidden inputs and buttons
      if (element.type === 'hidden' || element.tagName === 'BUTTON') return;
      
      // Check if element has an id
      if (!element.id || element.id.trim() === '') {
        missingLabels.push(element);
        return;
      }
      
      // Check if there's a label for this element
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (!label) {
        missingLabels.push(element);
      }
    });
    
    if (missingLabels.length > 0) {
      console.warn(`⚠️  ${missingLabels.length} form elements found without associated labels`);
      console.log('💡 Tip: Add labels with for attributes matching element ids');
      return true;
    }
    return false;
  }
  
  // Check for elements with very small text
  function checkSmallText() {
    const allElements = document.querySelectorAll('*');
    const smallTextElements = [];
    
    allElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const fontSize = parseFloat(computedStyle.fontSize);
      
      // Check for text smaller than 12px
      if (fontSize < 12 && element.textContent.trim() !== '') {
        // Only check visible elements
        if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
          smallTextElements.push({element, fontSize});
        }
      }
    });
    
    if (smallTextElements.length > 0) {
      console.warn(`⚠️  ${smallTextElements.length} elements found with text smaller than 12px`);
      console.log('💡 Tip: Ensure text is at least 14px for readability (16px preferred)');
      return true;
    }
    return false;
  }
  
  // Check for elements with low contrast
  function checkContrast() {
    // This is a simplified check - full contrast checking requires more complex calculations
    console.log('ℹ️  Note: Full contrast checking requires WCAG calculations. This is a simplified check.');
    return false;
  }
  
  // Run all checks
  function runAllChecks() {
    console.log('=== UI Debug Results ===');
    
    const issues = [];
    
    if (checkOverflow()) issues.push('Horizontal overflow');
    if (checkImages()) issues.push('Missing alt text');
    if (checkLinks()) issues.push('Links without href');
    if (checkButtons()) issues.push('Buttons without type');
    if (checkFormLabels()) issues.push('Form elements without labels');
    if (checkSmallText()) issues.push('Text too small');
    if (checkContrast()) issues.push('Low contrast');
    
    if (issues.length === 0) {
      console.log('✅ No issues found! UI appears to be in good shape.');
    } else {
      console.log(`\n📝 Summary: ${issues.length} potential issues found:`);
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    console.log('\n🔧 Debug Tips:');
    console.log('- Use browser dev tools to inspect elements highlighted in warnings');
    console.log('- Check the console for specific elements causing issues');
    console.log('- Test on different screen sizes to catch responsive issues');
    console.log('- Validate with accessibility tools for comprehensive testing');
  }
  
  // Add debug CSS to highlight issues
  function addDebugCSS() {
    const debugCSS = `
      /* Debug outlines for all elements */
      *:not(path):not(g) {
        outline: 1px solid rgba(255, 0, 0, 0.1);
      }
      
      /* Highlight images without alt text */
      img:not([alt]), img[alt=""] {
        outline: 2px solid red !important;
        background: rgba(255, 0, 0, 0.1);
      }
      
      /* Highlight links without href */
      a:not([href]), a[href=""] {
        outline: 2px solid orange !important;
        background: rgba(255, 165, 0, 0.1);
      }
      
      /* Highlight buttons without type */
      button:not([type]) {
        outline: 2px solid yellow !important;
        background: rgba(255, 255, 0, 0.1);
      }
      
      /* Highlight form elements without labels */
      input:not([id]), textarea:not([id]), select:not([id]),
      input[id=""], textarea[id=""], select[id=""] {
        outline: 2px solid purple !important;
        background: rgba(128, 0, 128, 0.1);
      }
    `;
    
    const style = document.createElement('style');
    style.id = 'ui-debug-css';
    style.textContent = debugCSS;
    document.head.appendChild(style);
    
    console.log('🎨 Debug CSS added - Elements will be outlined to help identify issues');
    console.log('💡 Legend:');
    console.log('  - Red outline: Images without alt text');
    console.log('  - Orange outline: Links without href');
    console.log('  - Yellow outline: Buttons without type');
    console.log('  - Purple outline: Form elements without id');
  }
  
  // Remove debug CSS
  function removeDebugCSS() {
    const debugStyle = document.getElementById('ui-debug-css');
    if (debugStyle) {
      debugStyle.remove();
      console.log('🧹 Debug CSS removed');
    }
  }
  
  // Public API
  window.RVOISUIDebug = {
    run: runAllChecks,
    debugCSS: {
      add: addDebugCSS,
      remove: removeDebugCSS
    },
    checks: {
      overflow: checkOverflow,
      images: checkImages,
      links: checkLinks,
      buttons: checkButtons,
      formLabels: checkFormLabels,
      smallText: checkSmallText,
      contrast: checkContrast
    }
  };
  
  console.log('✅ RVOIS UI Debug Script loaded successfully!');
  console.log('🚀 Run "RVOISUIDebug.run()" to check for UI issues');
  console.log('🎨 Run "RVOISUIDebug.debugCSS.add()" to add visual debugging outlines');
  console.log('🧹 Run "RVOISUIDebug.debugCSS.remove()" to remove visual debugging outlines');
  
})();