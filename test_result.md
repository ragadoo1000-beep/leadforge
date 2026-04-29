#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Build a high-converting, modern SaaS landing page for "LeadForge AI" with dark theme, premium feel,
  email signup capture for early access. Includes hero with animated mockup, How it Works (3 steps),
  Features (4 cards with hover lift), Social Proof testimonials, Email Capture form (email + role
  dropdown), and Footer with legal links. Inspired by Stripe/Linear/Vercel/Notion. No glassmorphism.

backend:
  - task: "Public early-access signup endpoint (POST /api/early-access/signup)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added public no-auth endpoint that captures email + optional role + source. Stores in db.early_access (unique by email, idempotent). Validated via curl: new email returns already_registered=false, duplicate returns true, invalid email returns 422."
        -working: true
        -agent: "testing"
        -comment: "Verified via /app/backend_test.py against the public preview URL. All assertions pass: (1) new email returns {ok:true, already_registered:false}, (2) duplicate email is idempotent and returns already_registered:true, (3) invalid email 'not-an-email' returns 422, (4) email is normalized — submitting 'FOO.<id>@LEADFORGE-TEST.IO  ' (uppercase + trailing whitespace) and then 'foo.<id>@leadforge-test.io' (lowercase) the second call returns already_registered:true confirming lowercase+trim, (5) role/source are length-capped at 40 chars — confirmed by direct Mongo inspection of db.early_access doc (role=200 'A's stored as 40, source=200 'B's stored as 40), (6) endpoint is public — works with no Authorization header AND with an invalid bearer token."

  - task: "Public early-access count endpoint (GET /api/early-access/count)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Returns total signups for social proof on landing page."
        -working: true
        -agent: "testing"
        -comment: "Verified via /app/backend_test.py: returns {count: <int>}, increments by exactly 1 after a new email signup (before=4, after=5), stays stable on duplicate signup (after_dup=5 confirming distinct-email uniqueness), and is public (200 with no auth header and with invalid bearer)."

frontend:
  - task: "LeadForge AI marketing landing page"
    implemented: true
    working: true
    file: "frontend/src/screens/LandingScreen.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Built premium dark-themed landing page with hero (animated 3D-tilted mockup card + floating AI Draft mini card), How it Works (3 steps), Features (4 cards with hover lift), Testimonials, Email Capture (email + role dropdown), and Footer. Uses fade+rise on mount, subtle floating motion on mockup, hover lift on cards. Fully responsive (>=980 desktop, 720-980 tablet, <720 mobile). Mounted at root index.tsx for unauthenticated visitors; authenticated users redirect to /(tabs)/feed as before. Verified visually on desktop (1440px) and mobile (414px). Backend signup endpoint integrated and verified via curl."

  - task: "Index route renders landing for guests, redirects authenticated users"
    implemented: true
    working: true
    file: "frontend/app/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Updated /app/index.tsx so that unauthenticated visitors see LandingScreen at /, while logged-in users redirect to /(tabs)/feed (or /onboarding if not yet onboarded). Splash backdrop also recolored dark to avoid light flash before fonts load."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 6
  run_ui: false

test_plan:
  current_focus:
    - "Public early-access signup endpoint (POST /api/early-access/signup)"
    - "Public early-access count endpoint (GET /api/early-access/count)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Built the LeadForge AI landing page mounted at /. Two new public backend endpoints added: POST /api/early-access/signup (idempotent on email) and GET /api/early-access/count. Please run targeted backend tests on these two endpoints — verify: (1) successful signup with email+role+source, (2) idempotency when same email submitted twice (already_registered=true), (3) invalid email returns 422, (4) count endpoint returns the integer count, (5) confirm no PII leak in response and that endpoints are public (no auth header required). Please also run a regression check on the existing endpoints (auth/login, leads/feed, billing/plans) to ensure the small server.py changes did not regress anything."
    -agent: "testing"
    -message: "Backend testing complete. All 16 assertions pass (10 early-access + 6 regression). Early-access endpoints are fully working: idempotent on email, validates email format (422 on bad input), normalizes (lowercase + trim), caps role/source at 40 chars (verified directly in MongoDB), and is public (no auth required, also accepts requests with garbage Authorization header). Count endpoint reflects distinct emails — increments by 1 on new signup, stable on duplicate signup. Regression: /auth/register, /auth/login, /auth/me (with token test@leadforge.io / test1234), /billing/plans, /policy, /leads/feed all return 200. Test script saved at /app/backend_test.py."
