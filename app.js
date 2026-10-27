/**
 * CS25C12 - Algorithms Course Portal Engine
 * Handles accordion interactions, responsive mobile navigation,
 * active scroll spying, and interactive unit quiz evaluations.
 */

// Quiz Data derived from the Course Syllabus Bank
const quizData = {
  unit1: [
    {
      q: "1. Which asymptotic notation gives an asymptotic upper bound?",
      options: ["Ω (Omega)", "O (Big O)", "Θ (Theta)", "o (little-o)"],
      answer: 1
    },
    {
      q: "2. If an algorithm has two nested loops each running n times, the basic operation count is typically:",
      options: ["Θ(1)", "Θ(log n)", "Θ(n)", "Θ(n²)"],
      answer: 3
    },
    {
      q: "3. Which notation characterises a tight asymptotic bound when both upper and lower bounds match?",
      options: ["Θ (Theta)", "O (Big O)", "Ω (Omega)", "o (little-o)"],
      answer: 0
    },
    {
      q: "4. What is the main purpose of probabilistic analysis?",
      options: [
        "Ignore input distribution",
        "Analyse expected behaviour under a probability model",
        "Always find worst case",
        "Remove recursion"
      ],
      answer: 1
    }
  ],
  unit2: [
    {
      q: "1. Which algorithm is a classic divide-and-conquer sorting method?",
      options: ["Merge sort", "Linear search", "Insertion sort", "Selection sort"],
      answer: 0
    },
    {
      q: "2. The Master method is commonly used to solve:",
      options: [
        "Graph colouring directly",
        "Certain divide-and-conquer recurrences",
        "String hashes only",
        "Flow conservation equations"
      ],
      answer: 1
    },
    {
      q: "3. Strassen’s algorithm is associated with:",
      options: ["Matrix multiplication", "Convex hull", "Network flow", "String matching"],
      answer: 0
    },
    {
      q: "4. In job sequencing with deadlines, the usual objective is to:",
      options: [
        "Minimise number of jobs regardless of profit",
        "Maximise profit subject to deadlines and time slots",
        "Sort by name",
        "Find shortest path"
      ],
      answer: 1
    }
  ],
  unit3: [
    {
      q: "1. Huffman coding is used to construct:",
      options: [
        "Prefix codes with efficient average code length",
        "Convex hulls",
        "Maximum flows",
        "Hash tables"
      ],
      answer: 0
    },
    {
      q: "2. Fractional Knapsack allows:",
      options: [
        "Only whole items",
        "Items to be divided into fractions",
        "Negative capacity only",
        "No profit values"
      ],
      answer: 1
    },
    {
      q: "3. Which problem is commonly solved using dynamic programming?",
      options: ["0–1 Knapsack", "Jarvis March only", "Rabin–Karp only", "Extended Euclid only"],
      answer: 0
    },
    {
      q: "4. LCS stands for:",
      options: [
        "Least Cost Search",
        "Longest Common Subsequence",
        "Linear Convex Set",
        "Linked Code Sequence"
      ],
      answer: 1
    }
  ],
  unit4: [
    {
      q: "1. Which string-matching algorithm uses a rolling hash?",
      options: ["Rabin–Karp", "Merge sort", "Ford–Fulkerson", "Graham’s Scan"],
      answer: 0
    },
    {
      q: "2. Graham’s Scan is used to compute a:",
      options: ["Minimum-cost flow", "Convex hull", "Longest common subsequence", "Huffman tree"],
      answer: 1
    },
    {
      q: "3. The Extended Euclid Algorithm can be used to find:",
      options: [
        "Bézout coefficients along with the gcd",
        "A convex hull only",
        "A maximum flow only",
        "A Huffman code only"
      ],
      answer: 0
    },
    {
      q: "4. FFT is primarily used to compute efficiently:",
      options: [
        "Polynomial multiplication via transforms",
        "N-Queen placements only",
        "Graph colouring only",
        "Job deadlines only"
      ],
      answer: 0
    }
  ],
  unit5: [
    {
      q: "1. P is the class of decision problems solvable in:",
      options: [
        "Polynomial time by a deterministic algorithm",
        "Exponential space only",
        "Constant time only",
        "No finite time"
      ],
      answer: 0
    },
    {
      q: "2. A problem is NP-Complete when it is:",
      options: ["In P only", "In NP and NP-hard", "Always undecidable", "Always easy to optimise"],
      answer: 1
    },
    {
      q: "3. Which is a classic backtracking problem?",
      options: ["N-Queen", "Merge sort", "FFT", "Rabin–Karp hashing"],
      answer: 0
    },
    {
      q: "4. Approximation algorithms are especially useful for:",
      options: [
        "Some computationally difficult optimisation problems",
        "Replacing all exact algorithms",
        "Only sorting two numbers",
        "Eliminating input data"
      ],
      answer: 0
    }
  ],
  unit6: [
    {
      q: "1. A flow network typically has:",
      options: [
        "A source, a sink and capacity-constrained edges",
        "Only an unweighted tree",
        "No edges",
        "Only strings"
      ],
      answer: 0
    },
    {
      q: "2. Ford–Fulkerson is used to find:",
      options: ["Maximum flow", "Convex hull", "Matrix chain order", "String matches"],
      answer: 0
    },
    {
      q: "3. Edmonds–Karp selects augmenting paths using:",
      options: ["Breadth-first search", "Depth-first search only", "Random sorting", "Huffman coding"],
      answer: 0
    },
    {
      q: "4. Cycle-Cancelling is associated with:",
      options: ["Minimum-cost flow", "Asymptotic notation", "String hashing", "Matrix multiplication"],
      answer: 0
    }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initAccordions();
  initQuiz();
  initScrollSpy();
});

/* Mobile Menu Toggle */
function initMobileNav() {
  const menuBtn = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");

  if (menuBtn && navMenu) {
    menuBtn.addEventListener("click", () => {
      navMenu.classList.toggle("open");
    });

    // Close menu when a link is clicked
    navMenu.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("open");
      });
    });
  }
}

/* Accordion Component */
function initAccordions() {
  const accordionButtons = document.querySelectorAll(".accordion-btn");

  accordionButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      const panel = btn.nextElementSibling;

      // Close all other panels (optional behavior)
      accordionButtons.forEach((otherBtn) => {
        if (otherBtn !== btn) {
          otherBtn.setAttribute("aria-expanded", "false");
          if (otherBtn.nextElementSibling) {
            otherBtn.nextElementSibling.classList.remove("show");
          }
        }
      });

      // Toggle current panel
      btn.setAttribute("aria-expanded", (!expanded).toString());
      panel.classList.toggle("show");
    });
  });

  // Open first unit by default
  if (accordionButtons.length > 0) {
    accordionButtons[0].click();
  }
}

/* Interactive Quiz Loader */
function initQuiz() {
  const unitSelect = document.getElementById("unitSelect");
  const quizContainer = document.getElementById("quizContainer");

  function renderUnitQuiz(unitKey) {
    const questions = quizData[unitKey] || [];
    quizContainer.innerHTML = "";

    questions.forEach((item, qIdx) => {
      const card = document.createElement("div");
      card.className = "quiz-card";

      const qTitle = document.createElement("div");
      qTitle.className = "quiz-question";
      qTitle.textContent = item.q;
      card.appendChild(qTitle);

      const optionsWrapper = document.createElement("div");
      optionsWrapper.className = "quiz-options";

      const feedback = document.createElement("div");
      feedback.className = "quiz-feedback";

      item.options.forEach((optText, optIdx) => {
        const optBtn = document.createElement("button");
        optBtn.className = "opt-btn";
        optBtn.textContent = optText;

        optBtn.addEventListener("click", () => {
          // Disable all buttons in this question once answered
          const allBtns = optionsWrapper.querySelectorAll(".opt-btn");
          allBtns.forEach((b) => (b.disabled = true));

          if (optIdx === item.answer) {
            optBtn.classList.add("correct");
            feedback.textContent = "✓ Correct! Well done.";
            feedback.classList.add("success");
          } else {
            optBtn.classList.add("wrong");
            allBtns[item.answer].classList.add("correct");
            feedback.textContent = "✗ Incorrect. Review the unit materials above.";
            feedback.classList.add("error");
          }
        });

        optionsWrapper.appendChild(optBtn);
      });

      card.appendChild(optionsWrapper);
      card.appendChild(feedback);
      quizContainer.appendChild(card);
    });
  }

  if (unitSelect) {
    unitSelect.addEventListener("change", (e) => {
      renderUnitQuiz(e.target.value);
    });
    // Initial Render
    renderUnitQuiz("unit1");
  }
}

/* ScrollSpy for Top Nav */
function initScrollSpy() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-link");

  window.addEventListener("scroll", () => {
    let currentId = "";
    const scrollPos = window.scrollY + 100;

    sections.forEach((section) => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = section.getAttribute("id");
      }
    });

    navLinks.forEach((link) => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${currentId}`) {
        link.classList.add("active");
      }
    });
  });
}