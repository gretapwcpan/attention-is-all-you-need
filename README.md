# Attention Analytics - Know Where Your Focus Goes

A Chrome extension that tracks and analyzes your online attention patterns to help you understand where your focus goes and align your browsing with your learning and productivity goals.

## 🎯 Features

### Real-Time Attention Tracking
- **Current Focus Display** - See what you're reading and for how long
- **Focus Quality Indicators** - Deep Focus (10+ min), Active Reading (5-10 min), or Scanning (<5 min)
- **Live Progress Bar** - Visual representation of your focus depth

### Intelligent Categorization
- **Automatic Site Classification** - Learning, Development, Research, News, Social, and more
- **Topic Extraction** - Identifies key topics from page titles
- **Pattern Recognition** - Detects context switching, rabbit holes, and focus blocks

### Analytics & Insights
- **Daily Patterns** - Visual breakdown of where your attention goes
- **Focus Score** - Weighted metric based on deep focus time and intentionality
- **Smart Insights** - Personalized observations about your browsing habits
- **Weekly Summaries** - Track trends and improvements over time

### Minimalist Design
- **Clean Interface** - Distraction-free, data-focused design
- **Dark Mode Support** - Automatic theme based on system preferences
- **Glanceable Metrics** - Key information visible at a glance

## 📊 What It Tracks

- **Time Spent** - Duration on each website
- **Focus Types** - Deep focus, active reading, or scanning
- **Categories** - Automatic classification of websites
- **Topics** - Subjects you're exploring
- **Patterns** - Context switching, consistency, and efficiency

## 🚀 Installation

1. Clone this repository:
```bash
git clone https://github.com/gretapwcpan/you-are-what-you-read.git
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right

4. Click "Load unpacked" and select the extension directory

5. The Attention Analytics icon will appear in your toolbar

## 💡 How to Use

1. **Click the extension icon** to view your current focus and today's patterns
2. **Browse normally** - the extension tracks your attention automatically
3. **Check insights** - Review the AI-generated insights about your browsing
4. **Set intentions** - Define what you want to focus on today
5. **Export data** - Download your analytics for deeper analysis

## 🎨 User Interface

The extension features a minimalist design with:
- Current focus section showing real-time tracking
- Pattern visualization with color-coded categories
- Attention breakdown showing focus quality distribution
- Quick insights providing actionable observations
- Stats bar with key metrics

## 🔧 Technical Details

### Architecture
- **Background Service Worker** - Handles tab tracking and data processing
- **Content Script** - Extracts page information
- **Popup Interface** - Displays analytics and insights
- **Storage Manager** - Handles data persistence

### Data Privacy
- All data is stored locally in Chrome storage
- No external servers or data transmission
- Complete user control over data export/import
- Option to clear all data at any time

### Performance
- Lightweight tracking with minimal overhead
- Efficient data aggregation
- Automatic cleanup of old sessions
- Optimized for battery life

## 📈 Understanding Your Metrics

### Focus Score
A weighted combination of:
- **Deep Focus Time** (40%) - Sessions over 10 minutes
- **Consistency** (20%) - Regular browsing patterns
- **Intentionality** (20%) - Time on productive categories
- **Efficiency** (20%) - Ratio of deep focus to total sessions

### Categories
- **Learning** - Online courses, tutorials, educational content
- **Development** - GitHub, Stack Overflow, coding platforms
- **Research** - Academic papers, documentation, wikis
- **News** - News sites, tech blogs, current events
- **Social** - Social media, forums, communities
- **Reading** - Blogs, articles, long-form content
- **Productivity** - Task management, note-taking, tools

## 🛠️ Customization

### Settings (Coming Soon)
- Adjust focus thresholds
- Customize category definitions
- Set daily goals and intentions
- Configure break reminders
- Export/import settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Chrome Extension Manifest V3
- Inspired by the need for mindful browsing
- Designed for knowledge workers and lifelong learners

## 📮 Contact

For questions or feedback, please open an issue on GitHub.

---

**Note:** This extension is designed to help you understand your browsing patterns. It's not meant to judge or restrict your internet usage, but rather to provide insights that help you align your online time with your personal goals.
