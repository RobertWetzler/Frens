import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PostDto as PostType, CommentDto, ICommentDto, UserDto } from 'services/generated/generatedClient'
import { usePost } from 'hooks/usePosts';
import { ApiClient } from 'services/apiClient';
import Post from './Post';
import Svg, { Path } from 'react-native-svg';


const ThreadLine: React.FC<{
  color: string;
  isLastInBranch: boolean;
  hasReplies: boolean;
  depth: number;
  collapsed: boolean;
}> = ({ color, isLastInBranch, hasReplies, depth, collapsed }) => {
  return (
    <View style={styles.threadLineContainer}>
      {/* Main vertical line */}
      <View 
        style={[
          styles.verticalLine, 
          { backgroundColor: color },
          { height: 82 },// Hide line when collapsed
          (isLastInBranch && !hasReplies) && styles.lastCommentLine
        ]} 
      />
      
      {/* For child comments, draw the curved connector from parent to child */}
      {depth > 0 && (
        <Svg style={styles.connectorSvg} width={42} height={30}>
          <Path
            d={`M 1,0 Q 1,20 20,20 L 42,20`}
            stroke={color}
            strokeWidth={2}
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
};

// ...existing code...

const CommentTree: React.FC<{
    comment: CommentDto;
    depth: number;
    onAddReply: (text, parentCommentId: string | undefined) => Promise<CommentDto>
    isSubmitting: boolean;
    submitError: string | null;
    isLastInBranch?: boolean;
}> = ({ comment, depth, onAddReply, isSubmitting, submitError, isLastInBranch = false }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
  
    const handleReply = async () => {
        if (replyText.trim()) {
            try {
                await onAddReply(replyText.trim(), comment.id);
                setReplyText('');
                setIsReplying(false);
            } catch (error) {
                // Error is handled by parent component via submitError prop
            }
        }
    };

    // Use for debugging thread lines
    const lineColor = depth === 0 ? '#1DA1F2' : ['#FF4500', '#9370DB', '#4CBB17', '#FF8C00', '#1E90FF'][depth % 5];
    //const lineColor = '#97d6fc'
    const hasReplies = comment.replies && comment.replies.length > 0;
  
    return (
      <View style={[styles.commentContainer, { marginLeft: 8 }]}>
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
            />
          </TouchableOpacity>
          
          <View style={styles.commentBody}>
            <Text style={styles.commentAuthor}>{comment.user.name}</Text>
            {!collapsed && (
              <>
                <Text style={styles.commentText}>{comment.text}</Text>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="arrow-up-outline" size={18} color="#606060" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="arrow-down-outline" size={18} color="#606060" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={() => setIsReplying(!isReplying)}>
                    <Ionicons name="chatbox-outline" size={16} color="#606060" />
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
                                style={[styles.replyButton, isSubmitting && styles.disabledButton]}
                                onPress={handleReply}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.replyButtonText}>
                                    {isSubmitting ? 'Posting...' : 'Reply'}
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
      const [newCommentText, setNewCommentText] = useState('');
      const [isAddingComment, setIsAddingComment] = useState(false);

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
                setNewCommentText('');
                setIsAddingComment(false);
                return comment;
            } catch (error) {
                // Error handled by addReply
            }
        }
    };

    const addReply = async (text, parentCommentId: string | undefined ) => {
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Call the API to create the comment
            const response = await ApiClient.Instance.comment(
                text,
                postId,
                parentCommentId
            );

            // If the API call was successful, update the UI with the returned comment
            if (!parentCommentId) {
                // Adding a root-level comment
                setComments([...comments, response]);
            } else {
                // Adding a reply to an existing comment
                const updateReplies = (comments: CommentDto[]): CommentDto[] => {
                    return comments.map(comment => {
                        if (comment.id === parentCommentId) {
                            return new CommentDto({
                                ...comment,
                                replies: [...(comment.replies || []), response]
                            });
                        }
                        else if (comment.replies) {
                            return new CommentDto({
                                ...comment,
                                replies: updateReplies(comment.replies)
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
            console.error('Failed to post comment:', err);
            setSubmitError('Failed to post comment. Please try again.');
            throw err;
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle loading state
    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size={36} color="#0000ff" />
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
                    <Ionicons name="arrow-back" size={24} color="#1DA1F2" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Comments</Text>
            </View>
            <ScrollView style={styles.scrollView}>
                <View style={styles.postContainer}>
                    <Post post={post} isNavigable={false} />
                </View>
                <View style={styles.addCommentContainer}>
                    {isAddingComment ? (
                        <View>
                            {submitError && (
                                <Text style={styles.errorText}>{submitError}</Text>
                            )}
                            <TextInput
                                style={styles.addCommentInputActive}
                                placeholder="Write a comment..."
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
                                        setNewCommentText('');
                                    }}
                                    disabled={isSubmitting}
                                >
                                    <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.replyButton, isSubmitting && styles.disabledButton]}
                                    onPress={handleAddComment}
                                    disabled={isSubmitting || !newCommentText.trim()}
                                >
                                    <Text style={styles.replyButtonText}>
                                        {isSubmitting ? 'Posting...' : 'Comment'}
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
                        <Text style={styles.noCommentsText}>No comments yet. Be the first to comment!</Text>
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
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};
  
  const styles = StyleSheet.create({
    // Header stuff
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e1e4e8',
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 4,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 16,
    },
    container: {
      flex: 1,
      backgroundColor: 'white',
    },
    scrollView: {
      flex: 1,
      backgroundColor: 'white',
    },
    postContainer: {
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e1e4e8',
    },
    commentsContainer: {
      backgroundColor: 'white',
      paddingHorizontal: 12,
      paddingBottom: 20,
    },
    noCommentsContainer: {
      padding: 20,
      alignItems: 'center',
      backgroundColor: 'white',
    },
    noCommentsText: {
      color: '#606060',
      fontSize: 16,
    },
    commentContainer: {
      marginVertical: 8,
      marginLeft: 25,
      position: 'relative',
      //borderWidth: 2, // Add this line
      //borderColor: 'red', // Add this line
    },
    commentContent: {
      flexDirection: 'row',
    },
    collapseButton: {
      width: 24,
      alignItems: 'center',
      marginRight: 8,
    },
    threadLineContainer: {
      width: '100%',
      height: '100%',
      position: 'relative',
    },
    verticalLine: {
      position: 'absolute',
      width: 2,
      borderRadius: 1,
      left: 12,
      top: 19,
      bottom: 0,
      transform: [{ translateX: -1 }],
    },
    lastCommentLine: {
      bottom: '60%', // Line stops before end for last comments
    },
    connectorSvg: {
      position: 'relative',
      top: 0,
      right: '121%',
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
      position: 'relative',
      marginTop: 4,
    },
    commentBody: {
      flex: 1,
      paddingRight: 8,
      paddingBottom: 4,
    },
    commentAuthor: {
      fontWeight: '600',
      fontSize: 14,
      color: '#333',
      marginBottom: 4,
    },
    commentText: {
      fontSize: 15,
      lineHeight: 22,
      color: '#000000',
      marginBottom: 8,
    },
    actionButtons: {
      flexDirection: 'row',
      marginTop: 4,
      marginBottom: 8,
      alignItems: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 16,
      padding: 4,
    },
    actionButtonText: {
      marginLeft: 4,
      fontSize: 13,
      color: '#606060',
      fontWeight: '500',
    },
    errorText: {
      color: 'red',
      fontSize: 14,
      marginBottom: 8,
    },
    disabledButton: {
      opacity: 0.5,
    },
    replyContainer: {
      marginTop: 8,
      marginBottom: 16,
      backgroundColor: '#f8f9fa',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#e1e4e8',
    },
    replyInput: {
      borderWidth: 1,
      borderColor: '#e1e4e8',
      borderRadius: 8,
      padding: 12,
      minHeight: 80,
      backgroundColor: 'white',
      fontSize: 15,
    },
    replyButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
    },
    cancelButton: {
      marginLeft: 8,
      padding: 10,
      borderRadius: 8,
    },
    cancelButtonText: {
      color: '#555',
      fontWeight: '500',
    },
    replyButton: {
      marginLeft: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: '#1DA1F2',
      borderRadius: 8,
    },
    replyButtonText: {
      color: 'white',
      fontWeight: '600',
    },
    addCommentContainer: {
      padding: 16,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e1e4e8',
    },
    addCommentInputButton: {
      borderWidth: 1,
      borderColor: '#e1e4e8',
      borderRadius: 8,
      padding: 14,
      backgroundColor: '#f9f9f9',
    },
    addCommentPlaceholder: {
      color: '#8e8e8e',
      fontSize: 15,
    },
    addCommentInputActive: {
      borderWidth: 1,
      borderColor: '#1DA1F2',
      borderRadius: 8,
      padding: 12,
      backgroundColor: 'white',
      minHeight: 100,
      fontSize: 15,
      textAlignVertical: 'top',
    },
  });
  
  export default CommentSection;