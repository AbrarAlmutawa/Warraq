import { countWords } from "@/lib/workspace/manuscript";
import type { WorkspaceManuscript } from "@/lib/workspace/types";

/* Demo manuscript — parsed once; the workspace copies it into local state. */

export const DEMO_FULL_TITLE =
  "Lightweight Computer Vision for Plant Disease Recognition in Smart Agriculture: A Field-Deployable Deep Learning Approach Using UAV Imagery";

export const DEMO_COMPACT_TITLE =
  "Lightweight Computer Vision for Plant Disease Recognition in Smart Agriculture";

const DEMO_ABSTRACT =
  "This study examines computer vision methods for plant disease recognition in agriculture. Plant diseases cause major yield losses, yet field inspection remains slow and manual. We designed a lightweight convolutional neural network that runs on the embedded hardware of low-cost drones. Using 12,480 annotated leaf images collected from 36 farms in the Eastern Province of Saudi Arabia, the model reaches 94.1% accuracy with only 1.8 M parameters and processes 41 frames per second.";

/* Declared length of the full abstract in the parsed manuscript */
const DECLARED_ABSTRACT_WORDS = 236;

export const DEMO_HIGHLIGHTS_DRAFT = [
  "[Highlight 1 - max 85 characters]",
  "[Highlight 2 - max 85 characters]",
  "[Highlight 3 - max 85 characters]",
];

export const DEMO_HIGHLIGHTS_COMPLETE = [
  "A 1.8 M-parameter CNN recognizes plant diseases on board low-cost drones.",
  "New dataset: 12,480 annotated leaf images from 36 Saudi farms.",
  "Runs at 41 frames per second on an embedded GPU.",
];

export const DEMO_DATA_AVAILABILITY_DRAFT = "[Describe where the research data can be accessed]";

export const DEMO_DATA_AVAILABILITY_COMPLETE =
  "The drone image dataset and trained model weights are available from the corresponding author upon reasonable request.";

export const MOCK_WORKSPACE_MANUSCRIPT: WorkspaceManuscript = {
  title: DEMO_FULL_TITLE,
  abstract: DEMO_ABSTRACT,
  abstractWordOffset: DECLARED_ABSTRACT_WORDS - countWords(DEMO_ABSTRACT),
  keywords: [
    "Computer vision",
    "Smart agriculture",
    "Deep learning",
    "Image classification",
    "Plant disease detection",
    "Image recognition",
  ],
  highlights: null,
  dataAvailability: null,
  sections: [
    {
      id: "introduction",
      heading: "Introduction",
      paragraphs: [
        {
          text: "Plant diseases reduce crop yields worldwide and are often detected late, when manual scouting finally reaches affected fields {cite:1,2}. Early detection matters most for high-value crops such as date palms, which dominate agriculture in the Eastern Province.",
        },
        {
          text: "Deep learning models can recognize diseases from leaf images with high accuracy {cite:3}, but most are too heavy for the low-cost hardware available to farmers. This paper addresses that gap.",
        },
      ],
    },
    {
      id: "related-work",
      heading: "Related Work",
      paragraphs: [
        {
          text: "Lightweight architectures have been adapted for agricultural imagery {cite:3,4}, while aerial disease mapping has mostly relied on multispectral sensors {cite:5}. Few studies evaluate RGB-only models running directly on embedded devices.",
        },
      ],
    },
    {
      id: "methodology",
      heading: "Methodology",
      paragraphs: [
        {
          text: "We collected 12,480 leaf images from 36 farms using consumer drones flying at 8–12 m. Two plant pathologists annotated the images into four disease classes and healthy tissue {cite:6}.",
        },
        {
          text: "The model uses depthwise-separable convolutions and a compact attention block, reducing the parameter count to 1.8 M.",
        },
      ],
    },
    {
      id: "results",
      heading: "Results",
      paragraphs: [
        {
          text: "The model reached 94.1% accuracy and a macro F1-score of 0.92 on the held-out test set, compared with 93.4% for the strongest lightweight baseline {cite:4}.",
        },
        {
          text: "Figure 3. Sample drone frames showing leaf spot (left) and black scorch (right).",
          anchor: "figure-3",
        },
      ],
    },
    {
      id: "discussion",
      heading: "Discussion",
      paragraphs: [
        {
          text: "The results show that disease recognition does not require large models when the input domain is narrow.",
        },
        {
          text: "These findings suggest that lightweight models are promising for agriculture.",
        },
      ],
    },
    {
      id: "conclusion",
      heading: "Conclusion",
      paragraphs: [
        {
          text: "We introduced a lightweight disease-recognition model and a new field dataset. Future work will extend validation beyond the Eastern Province.",
        },
      ],
    },
  ],
  references: [
    {
      id: 1,
      inText: "Alharbi et al., 2023",
      apa: "Alharbi, S., Al-Qahtani, M., & Noor, F. (2023). Deep learning for date palm pest detection. Journal of Demo Agriculture, 14(2), 101–115.",
      ieee: "[1] S. Alharbi, M. Al-Qahtani, and F. Noor, “Deep learning for date palm pest detection,” Journal of Demo Agriculture, vol. 14, no. 2, pp. 101–115, 2023.",
    },
    {
      id: 2,
      inText: "Zhang & Li, 2022",
      apa: "Zhang, Y., & Li, H. (2022). Early warning systems for crop disease. Demo Plant Informatics, 8, 44–58.",
      ieee: "[2] Y. Zhang and H. Li, “Early warning systems for crop disease,” Demo Plant Informatics, vol. 8, pp. 44–58, 2022.",
    },
    {
      id: 3,
      inText: "Rahman et al., 2021",
      apa: "Rahman, A., Hossain, M., & Karim, R. (2021). Leaf disease classification with convolutional networks. Demo Computing in Agriculture, 5(1), 12–29.",
      ieee: "[3] A. Rahman, M. Hossain, and R. Karim, “Leaf disease classification with convolutional networks,” Demo Computing in Agriculture, vol. 5, no. 1, pp. 12–29, 2021.",
    },
    {
      id: 4,
      inText: "Kim & Park, 2020",
      apa: "Kim, J., & Park, S. (2020). Efficient mobile architectures for field imagery. Demo Vision Letters, 3, 77–90.",
      ieee: "[4] J. Kim and S. Park, “Efficient mobile architectures for field imagery,” Demo Vision Letters, vol. 3, pp. 77–90, 2020.",
    },
    {
      id: 5,
      inText: "Hassan & Omar, 2020",
      apa: "Hassan, N., & Omar, K. (2020). Multispectral drone mapping of crop stress. Demo Remote Sensing, 11(4), 201–219.",
      ieee: "[5] N. Hassan and K. Omar, “Multispectral drone mapping of crop stress,” Demo Remote Sensing, vol. 11, no. 4, pp. 201–219, 2020.",
    },
    {
      id: 6,
      inText: "Al-Mulhim et al., 2024",
      apa: "Al-Mulhim, F., Al-Dossary, S., & Albash, M. (2024). An annotated leaf-image dataset from Saudi farms. Demo Data in Brief, 2, 1–9.",
      ieee: "[6] F. Al-Mulhim, S. Al-Dossary, and M. Albash, “An annotated leaf-image dataset from Saudi farms,” Demo Data in Brief, vol. 2, pp. 1–9, 2024.",
    },
  ],
  referenceCount: 45,
  wordCount: 7850,
  figureCount: 8,
  tableCount: 4,
  citationStyle: "APA",
  format: "docx",
};