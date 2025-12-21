import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommentDto } from "services/generated/generatedClient";
import { usePost } from "hooks/usePosts";
import { ApiClient } from "services/apiClient";
import Post from "./Post";
import Svg, { Path } from "react-native-svg";
import Username from "./Username";
import { useTheme } from "../theme/ThemeContext";
import { makeStyles } from "../theme/makeStyles";

interface ThreadLineProps {
  color: string;
  isLastInBranch: boolean;
  hasReplies: boolean;
  depth: number;
  collapsed: boolean;
  isReplying: boolean;
  lastChildHeight?: number;
  styles: ReturnType<typeof useCommentStyles>;
}

const ThreadLine: React.FC<ThreadLineProps> = ({
  color,
  isLastInBranch,
  hasReplies,
  depth,
  collapsed,
  isReplying,
  lastChildHeight = 0,
  styles,
}) => {
  const replyBoxHeight = 176.12;
  const height = collapsed ? 0 : 74 + (isReplying ? replyBoxHeight : 0);
  var amountToHide = 150;
  // If we have the last child's height, adjust the vertical line length
  if (hasReplies && lastChildHeight > 0) {
    // Subtract the last child's height from the amount to hide
    // This makes the line stop right where the last child begins
    amountToHide = lastChildHeight;
  }

  return (
    true && (
      // To do this, take the height of the full comment tree minus the height of the comment tree of the last comment
      <View style={styles.threadLineContainer}>
        {/* Main vertical line (can add || isReplying to add line to reply box on last in branch*/}
        {!collapsed && hasReplies && (
          <View
            style={[
              styles.verticalLine,
              {
                backgroundColor: color,
                // Hide a certain amount from the bottom to connect to the curved connector of the last connebt
                bottom: amountToHide,
              },
            ]}
          />
        )}
        {/* For child comments, draw the curved connector from parent to child */}
        {depth > 0 && (
          <Svg style={styles.connectorSvg} width={42} height={30}>
            <Path
              d={`M 1,0 Q 1,20 20,20 L 26,20`}
              stroke={color}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        )}
        {/* Curved connector connecting to the reply box 
          TODO: Curved line to reply box for last comment in branch - just use full height for vertical line*/}
        {!collapsed && hasReplies && isReplying && (
          <Svg
            style={[
              {
                transform: [
                  { translateY: 150 },
                  { translateX: styles.verticalLine.left },
                ],
              },
            ]}
            width={42}
            height={30}
          >
            <Path
              d={`M 1,0 Q 1,20 20,20 L 26,20`}
              stroke={color}
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        )}
      </View>
    )
  );
};

const formatDate = (date: Date) => {
  const now = new Date();
  const isCurrentYear = now.getFullYear() === date.getFullYear();

  const options: Intl.DateTimeFormatOptions = {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  if (!isCurrentYear) {
    options.year = 'numeric';
  }

  return date.toLocaleString('en-US', options);
};

interface CommentTreeProps {
  comment: CommentDto;
  depth: number;
  onAddReply: (
    text,
    parentCommentId: string | undefined
  ) => Promise<CommentDto>;
  isSubmitting: boolean;
  submitError: string | null;
  isLastInBranch?: boolean;
  onHeightMeasure?: (height: number) => void;
  navigation?: any;
  styles: ReturnType<typeof useCommentStyles>;
}

const CommentTree: React.FC<CommentTreeProps> = ({
  comment,
  depth,
  onAddReply,
  isSubmitting,
  submitError,
  isLastInBranch = false,
  onHeightMeasure,
  navigation,
  styles,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [lastChildHeight, setLastChildHeight] = useState(0);
  // Using theme-aware styles from parent invocation; hook can be called here too without redeclare conflicts
  const { theme } = useTheme();
  // Function to capture height from the last child
  const handleLastChildHeight = (height: number) => {
    setLastChildHeight(height);
  };

  // Report own height to parent when mounted and when height changes
  const handleLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    // Only report height if this component is measuring itself for its parent
    if (onHeightMeasure) {
      onHeightMeasure(height);
    }
  };
  const handleReply = async () => {
    if (replyText.trim()) {
      try {
        await onAddReply(replyText.trim(), comment.id);
        setReplyText("");
        setIsReplying(false);
      } catch (error) {
        // Error is handled by parent component via submitError prop
      }
    }
  };

  // Use for debugging thread lines
  //const lineColor = depth === 0 ? '#1DA1F2' : ['#FF4500', '#9370DB', '#4CBB17', '#FF8C00', '#1E90FF'][depth % 5];
  const lineColor = theme.colors.primary;
  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <View
      style={[styles.commentContainer, { marginLeft: 8 }]}
      onLayout={handleLayout}
    >
      <View style={styles.commentContent}>
        <TouchableOpacity
          style={styles.collapseButton}
          onPress={() => setCollapsed(!collapsed)}
        >
          <ThreadLine
            color={lineColor}
            isLastInBranch={isLastInBranch}
            hasReplies={hasReplies}
            depth={depth}
            collapsed={collapsed}
            isReplying={isReplying}
            lastChildHeight={lastChildHeight} // Pass the last child's height
            styles={styles}
          />
        </TouchableOpacity>

        <View style={styles.commentBody}>
          <View style={styles.commentHeaderRow}>
            <Username
              user={comment.user}
              navigation={navigation}
              styles={{
                container: styles.commentTitleRow,
                username: styles.commentAuthor,
              }}
              showAvatar
            />
            {comment.date && (
              <Text style={styles.commentDate}>{formatDate(new Date(comment.date))}</Text>
            )}
          </View>

          {!collapsed && (
            <>
              <Text style={styles.commentText}>{comment.text}</Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons
                    name="heart-outline"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setIsReplying(!isReplying)}
                >
                  <Ionicons
                    name="chatbox-outline"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.actionButtonText}>Reply</Text>
                </TouchableOpacity>
              </View>
              {isReplying && (
                <View style={styles.replyContainer}>
                  {submitError && (
                    <Text style={styles.errorText}>{submitError}</Text>
                  )}
                  <TextInput
                    style={styles.replyInput}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder="Type your reply..."
                    multiline
                    editable={!isSubmitting}
                  />
                  <View style={styles.replyButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setIsReplying(false)}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.replyButton,
                        isSubmitting && styles.disabledButton,
                      ]}
                      onPress={handleReply}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.replyButtonText}>
                        {isSubmitting ? "Posting..." : "Reply"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {!collapsed && hasReplies && (
                <View style={styles.replyTreeContainer}>
                  {comment.replies.map((reply, index) => (
                    <CommentTree
                      key={reply.id}
                      comment={reply}
                      depth={depth + 1}
                      onAddReply={onAddReply}
                      isSubmitting={isSubmitting}
                      submitError={submitError}
                      isLastInBranch={index === comment.replies.length - 1}
                      onHeightMeasure={
                        index === comment.replies.length - 1
                          ? handleLastChildHeight
                          : undefined
                      }
                      navigation={navigation}
                      styles={styles}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const CommentSection: React.FC<{
  route: { params: { postId: string } };
  navigation: any;
}> = ({ route, navigation }) => {
  const { postId } = route.params;
  const { post, isLoading, error, loadPost } = usePost(postId, true);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const { theme } = useTheme();
  const styles = useCommentStyles();

  // Update comments when post data is loaded
  useEffect(() => {
    if (post?.comments) {
      setComments(post.comments);
    }
  }, [post]);

  const handleAddComment = async () => {
    if (newCommentText.trim()) {
      try {
        const comment = await addReply(newCommentText.trim(), undefined);
        setNewCommentText("");
        setIsAddingComment(false);
        return comment;
      } catch (error) {
        // Error handled by addReply
      }
    }
  };

  const addReply = async (text, parentCommentId: string | undefined) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Call the API to create the comment
      const response = await ApiClient.call((c) =>
        c.comment_PostComment(text, postId, parentCommentId)
      );

      // If the API call was successful, update the UI with the returned comment
      if (!parentCommentId) {
        // Adding a root-level comment
        setComments([...comments, response]);
      } else {
        // Adding a reply to an existing comment
        const updateReplies = (comments: CommentDto[]): CommentDto[] => {
          return comments.map((comment) => {
            if (comment.id === parentCommentId) {
              return new CommentDto({
                ...comment,
                replies: [...(comment.replies || []), response],
              });
            } else if (comment.replies) {
              return new CommentDto({
                ...comment,
                replies: updateReplies(comment.replies),
              });
            }
            return comment;
          });
        };

        setComments(updateReplies(comments));
      }
      setSubmitError(null);
      return response;
    } catch (err) {
      console.error("Failed to post comment:", err);
      setSubmitError("Failed to post comment. Please try again.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size={36} color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  // Handle error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  // Handle case where post is undefined
  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Post not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comments</Text>
      </View>
      <ScrollView style={styles.scrollView}>
        <View style={styles.postContainer}>
          <Post 
            post={post} 
            navigation={navigation}
            shouldAnimate={false}
            showDefaultCommentButton={false}
          />
        </View>
        <View style={styles.addCommentContainer}>
          {isAddingComment ? (
            <View>
              {submitError && (
                <Text style={styles.errorText}>{submitError}</Text>
              )}
              <TextInput
                style={styles.addCommentInputActive}
                placeholder="Add a comment..."
                multiline
                value={newCommentText}
                onChangeText={setNewCommentText}
                autoFocus
              />
              <View style={styles.replyButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsAddingComment(false);
                    setNewCommentText("");
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.replyButton,
                    isSubmitting && styles.disabledButton,
                  ]}
                  onPress={handleAddComment}
                  disabled={isSubmitting || !newCommentText.trim()}
                >
                  <Text style={styles.replyButtonText}>
                    {isSubmitting ? "Posting..." : "Comment"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setIsAddingComment(true)}
              style={styles.addCommentInputButton}
            >
              <Text style={styles.addCommentPlaceholder}>Add a comment...</Text>
            </TouchableOpacity>
          )}
        </View>
        {comments.length === 0 ? (
          <View style={styles.noCommentsContainer}>
            <Text style={styles.noCommentsText}>
              No comments yet. Be the first to comment!
            </Text>
          </View>
        ) : (
          <View style={styles.commentsContainer}>
            {comments.map((comment, index) => (
              <CommentTree
                key={comment.id}
                comment={comment}
                depth={0}
                onAddReply={addReply}
                isSubmitting={isSubmitting}
                submitError={submitError}
                isLastInBranch={index === comments.length - 1}
                navigation={navigation}
                styles={styles}
                // Only measure the last child's height
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const useCommentStyles = makeStyles((theme) => ({
  // Header stuff
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 16,
    color: theme.colors.textPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  postContainer: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  commentsContainer: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  noCommentsContainer: {
    padding: 20,
    alignItems: "center",
    backgroundColor: theme.colors.card,
  },
  noCommentsText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  commentContainer: {
    marginVertical: 1,
    marginLeft: 25,
    position: "relative",
  },
  commentContent: {
    flexDirection: "row",
  },
  collapseButton: {
    width: 24,
    alignItems: "center",
    marginRight: 8,
  },
  threadLineContainer: {
    width: 24,
    height: "100%",
    position: "absolute",
  },
  verticalLine: {
    position: "absolute",
    width: 2,
    borderRadius: 1,
    left: 13,
    top: 41,
  },
  lastCommentLine: {
    bottom: "60%", // Line stops before end for last comments
  },
  connectorSvg: {
    position: "relative",
    top: 0,
    //right: '116%',
    left: -13 * 2 - 1, //calculate based on verticalLine.left
    transform: [{ translateX: 0 }], // Super magic number to align with parent vertiical line
  },
  // Remove or comment out these old connector styles
  // horizontalConnector: {
  //   position: 'absolute',
  //   height: 2,
  //   width: 12,
  //   borderRadius: 1,
  //   left: '50%', // Start from the vertical line
  //   right: 0,
  //   top: 12, // Align with username
  // },
  // connectorToParent: {
  //   position: 'absolute',
  //   height: 2,
  //   width: 16, // Width of left margin
  //   borderRadius: 1,
  //   right: '50%',
  //   top: 12, // Align with the username
  //   left: -16, // Extend to the left to connect with parent
  // },
  replyTreeContainer: {
    position: "relative",
    marginTop: 4,
  },
  commentBody: {
    flex: 1,
    paddingRight: 8,
    paddingBottom: 0,
    //borderWidth: 0.5, // Add this line
    //borderColor: 'red', // Add this line
  },
  commentTitleRow: {
    flexDirection: "row",
    marginTop: 4,
    marginLeft: -37, // Use margins when needed
    marginBottom: 0,
    alignItems: "center",
  },
  commentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  commentAuthor: {
    fontWeight: "600",
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    left: 9,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 4,
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    padding: 4,
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  replyContainer: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: theme.colors.backgroundAlt,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.separator,
  },
  replyInput: {
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    backgroundColor: theme.colors.card,
    fontSize: 15,
  },
  replyButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  cancelButton: {
    marginLeft: 8,
    padding: 10,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: theme.colors.textMuted,
    fontWeight: "500",
  },
  replyButton: {
    marginLeft: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
  },
  replyButtonText: {
    color: theme.colors.primaryContrast,
    fontWeight: "600",
  },
  addCommentContainer: {
    padding: 12,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.separator,
  },
  addCommentInputButton: {
    borderWidth: 1,
    borderColor: theme.colors.separator,
    borderRadius: 8,
    padding: 14,
    backgroundColor: theme.colors.backgroundAlt,
  },
  addCommentPlaceholder: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  addCommentInputActive: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 8,
    padding: 12,
    backgroundColor: theme.colors.card,
    minHeight: 100,
    fontSize: 15,
    textAlignVertical: "top",
  },
}));

export default CommentSection;
